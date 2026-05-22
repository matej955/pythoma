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
  serverTimestamp,
} from "firebase/firestore";
import { getFirestore } from "firebase/firestore";

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

export function sendCommunityMessage({ text, user }) {
  const cleanText = text.trim();
  if (!cleanText) return Promise.resolve();

  return addDoc(collection(db, "communityMessages"), {
    text: cleanText,
    name: user?.name || "Ratnica",
    email: user?.email || "",
    uid: auth.currentUser?.uid || "",
    createdAt: serverTimestamp(),
  });
}
