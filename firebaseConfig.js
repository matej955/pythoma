import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  getDocs,
  startAfter,
  where,
  getCountFromServer,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getFirestore } from "firebase/firestore";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyD48TI_Ugg1JxAS8gpZHBrw83deMZcS9WQ",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "pythoma-d784a.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "pythoma-d784a",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "pythoma-d784a.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1005630251237",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:1005630251237:web:6585558c42c6447ff5740c",
};

export const googleClientIds = {
  clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID || "",
  iosClientId:
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID ||
    "",
  androidClientId:
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID ||
    "",
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID || "",
};

export const hasFirebaseConfig = !firebaseConfig.apiKey.includes("PASTE_") && !firebaseConfig.appId.includes("PASTE_");
export const firebaseConfigStatus = {
  apiKeyPrefix: firebaseConfig.apiKey.slice(0, 10),
  appId: firebaseConfig.appId,
  projectId: firebaseConfig.projectId,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

function createAuth() {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    return getAuth(app);
  }
}

export const auth = createAuth();
export const db = getFirestore(app);

export async function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function registerWithEmail({ email, password, name }) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (name) {
    await updateProfile(credential.user, { displayName: name });
  }
  return credential;
}

export async function loginWithGoogleIdToken(idToken) {
  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
}

export function logout() {
  return signOut(auth);
}

export function subscribeToCommunityMessages(onMessages, onError) {
  const messagesQuery = query(collection(db, "communityMessages"), orderBy("createdAt", "desc"), limit(50));
  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      const messages = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .reverse();
      onMessages(messages);
    },
    onError,
  );
}

// Get total count of community messages (uses Firestore count aggregation)
export async function getCommunityMessagesCount() {
  try {
    const snapshot = await getCountFromServer(query(collection(db, "communityMessages")));
    return snapshot.data().count || 0;
  } catch (error) {
    // fallback: return 0 on error
    return 0;
  }
}

// Fetch the latest page of messages (most recent `pageSize`), returns messages (asc order) and the last visible doc for pagination
export async function fetchLatestCommunityMessages(pageSize = 20) {
  const q = query(collection(db, "communityMessages"), orderBy("createdAt", "desc"), limit(pageSize));
  const snapshot = await getDocs(q);
  const messages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).reverse();
  const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
  return { messages, lastVisible };
}

// Fetch older messages after the provided `lastVisible` (DocumentSnapshot) in pages of `pageSize`
export async function fetchCommunityMessagesBefore(lastVisible, pageSize = 20) {
  if (!lastVisible) return { messages: [], lastVisible: null, hasMore: false };
  const q = query(collection(db, "communityMessages"), orderBy("createdAt", "desc"), startAfter(lastVisible), limit(pageSize));
  const snapshot = await getDocs(q);
  const messages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).reverse();
  const newLastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
  return { messages, lastVisible: newLastVisible, hasMore: snapshot.size === pageSize };
}

// Subscribe to only the newest message in real-time (useful to append incoming messages)
export function subscribeToNewCommunityMessages(onNewMessage, onError) {
  const q = query(collection(db, "communityMessages"), orderBy("createdAt", "desc"), limit(1));
  return onSnapshot(
    q,
    (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const newest = docs[0];
      if (newest) onNewMessage(newest);
    },
    onError,
  );
}

// Fetch user's active programs (if stored in Firestore under `userPrograms`)
export async function getUserActivePrograms(identifier) {
  if (!identifier) return [];
  try {
    const field = identifier.includes("@") ? "email" : "uid";
    const q = query(collection(db, "userPrograms"), where(field, "==", identifier));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    return [];
  }
}

export async function getUserSubscription({ uid, email } = {}) {
  const currentUid = uid || auth.currentUser?.uid || "";
  const currentEmail = email || auth.currentUser?.email || "";
  const records = [];

  async function readDoc(collectionName, id) {
    if (!id || id.includes("/")) return;
    try {
      const snapshot = await getDoc(doc(db, collectionName, id));
      if (snapshot.exists()) {
        records.push({ id: snapshot.id, source: collectionName, ...snapshot.data() });
      }
    } catch (error) {
      // Keep checking other possible entitlement locations.
    }
  }

  async function readQuery(collectionName, field, value) {
    if (!value) return;
    try {
      const snapshot = await getDocs(query(collection(db, collectionName), where(field, "==", value), limit(5)));
      snapshot.docs.forEach((subscriptionDoc) => {
        records.push({ id: subscriptionDoc.id, source: collectionName, ...subscriptionDoc.data() });
      });
    } catch (error) {
      // Keep checking other possible entitlement locations.
    }
  }

  await Promise.all([
    readDoc("users", currentUid),
    readDoc("profiles", currentUid),
    readDoc("subscriptions", currentUid),
    readDoc("users", currentEmail),
    readQuery("userSubscriptions", "uid", currentUid),
    readQuery("userSubscriptions", "email", currentEmail),
    readQuery("subscriptions", "uid", currentUid),
    readQuery("subscriptions", "email", currentEmail),
  ]);

  return records;
}

// Upload a local file URI to Firebase Storage. Accepts an optional progress callback
export async function uploadFileAsync(uri, onProgress) {
  if (!uri) return null;
  const storage = getStorage(app);
  const response = await fetch(uri);
  const blob = await response.blob();
  const rawExt = (uri.split(".").pop() || "jpg").split("?")[0];
  const filename = `community/${Date.now()}_${Math.random().toString(36).slice(2)}.${rawExt}`;
  const storageReference = storageRef(storage, filename);

  const uploadTask = uploadBytesResumable(storageReference, blob);
  const promise = new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const pct = snapshot.totalBytes ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) : 0;
        if (onProgress) onProgress(pct);
      },
      (error) => reject(error),
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({ url, path: filename });
        } catch (err) {
          reject(err);
        }
      },
    );
  });

  promise.cancel = () => {
    try {
      uploadTask.cancel && uploadTask.cancel();
    } catch (error) {
      // Ignore cancel errors; callers only need best-effort cancellation.
    }
  };

  return promise;
}

// Likes helpers: using a subcollection `communityMessages/{messageId}/likes/{uid}`
export async function getLikesCount(messageId) {
  try {
    const q = query(collection(db, "communityMessages", messageId, "likes"));
    const snap = await getCountFromServer(q);
    return snap.data().count || 0;
  } catch (err) {
    return 0;
  }
}

export async function toggleMessageLike(messageId) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");
  const likeRef = doc(db, "communityMessages", messageId, "likes", uid);
  const likeSnap = await getDoc(likeRef);
  if (likeSnap.exists()) {
    await deleteDoc(likeRef);
    return { liked: false };
  } else {
    await setDoc(likeRef, { uid, createdAt: serverTimestamp() });
    return { liked: true };
  }
}

export function subscribeToMessageLikes(messageId, onChange, onError) {
  const q = query(collection(db, "communityMessages", messageId, "likes"));
  return onSnapshot(
    q,
    (snapshot) => onChange(snapshot.size),
    onError,
  );
}

export function sendCommunityMessage({ text, user, attachments = [] }) {
  const cleanText = (text || "").trim();
  if (!cleanText && (!attachments || attachments.length === 0)) return Promise.resolve();

  return addDoc(collection(db, "communityMessages"), {
    text: cleanText,
    attachments,
    name: user?.name || "Ratnica",
    email: user?.email || "",
    uid: auth.currentUser?.uid || "",
    createdAt: serverTimestamp(),
  });
}
