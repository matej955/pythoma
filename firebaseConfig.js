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
  runTransaction,
  increment,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { getFirestore } from "firebase/firestore";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { FIREBASE_ANALYTICS_EVENTS, FIREBASE_COLLECTIONS, FIREBASE_DOCUMENTS, FIREBASE_SUBCOLLECTIONS } from "./firebaseModels";

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

const APP_CONTENT_COLLECTION = FIREBASE_COLLECTIONS.appContent;
const APP_CONTENT_DOCUMENT = FIREBASE_DOCUMENTS.appContentRoot;
const COMMUNITY_MESSAGES_COLLECTION = FIREBASE_COLLECTIONS.communityMessages;
const HIDDEN_MESSAGE_STATES = new Set(["hidden", "removed", "blocked"]);

function appContentRef() {
  return doc(db, APP_CONTENT_COLLECTION, APP_CONTENT_DOCUMENT);
}

function appContentCollectionRef(collectionName) {
  return collection(db, APP_CONTENT_COLLECTION, APP_CONTENT_DOCUMENT, collectionName);
}

function appContentDocRef(collectionName, documentId) {
  return doc(db, APP_CONTENT_COLLECTION, APP_CONTENT_DOCUMENT, collectionName, documentId);
}

async function getOrderedAppContentDocs(collectionName) {
  const snapshot = await getDocs(query(appContentCollectionRef(collectionName), orderBy("order", "asc")));
  return snapshot.docs.map((contentDoc) => ({
    id: contentDoc.id,
    ...contentDoc.data(),
  }));
}

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

export function subscribeToAppContent(onContent, onError) {
  return onSnapshot(
    appContentRef(),
    (snapshot) => {
      onContent(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
    },
    onError,
  );
}

export async function fetchAppContentManifest() {
  const snapshot = await getDoc(appContentRef());
  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  return {
    schemaVersion: data.schemaVersion,
    modelVersion: data.modelVersion,
    contentVersion: data.contentVersion,
    sectionVersions: data.sectionVersions || {},
    cache: data.cache,
    updatedAt: data.updatedAt,
  };
}

export async function fetchAppContent() {
  const [rootSnapshot, settingsSnapshot, imageDocs, programDocs, potionDocs, navDocs, communityPostDocs] = await Promise.all([
    getDoc(appContentRef()),
    getDoc(appContentDocRef("settings", "main")),
    getOrderedAppContentDocs("images"),
    getOrderedAppContentDocs("programs"),
    getOrderedAppContentDocs("potions"),
    getOrderedAppContentDocs("navItems"),
    getOrderedAppContentDocs("communityPosts"),
  ]);

  const root = rootSnapshot.exists() ? rootSnapshot.data() : {};
  const images = imageDocs.reduce((acc, item) => {
    acc[item.key || item.id] = item.url || item.uri || item.src || "";
    return acc;
  }, {});

  return {
    schemaVersion: root.schemaVersion,
    modelVersion: root.modelVersion,
    contentVersion: root.contentVersion,
    sectionVersions: root.sectionVersions || {},
    cache: root.cache,
    images: Object.keys(images).length ? images : root.images,
    programs: programDocs.length ? programDocs : root.programs || root.allPrograms,
    communityPosts: communityPostDocs.length ? communityPostDocs : root.communityPosts,
    potions: potionDocs.length ? potionDocs : root.potions,
    navItems: navDocs.length ? navDocs : root.navItems,
    settings: settingsSnapshot.exists() ? settingsSnapshot.data() : root.settings,
    updatedAt: root.updatedAt,
  };
}

export async function uploadAppContent(content) {
  if (!content || typeof content !== "object") {
    throw new Error("Missing app content payload.");
  }

  return setDoc(
    appContentRef(),
    {
      ...content,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

function compactAnalyticsPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  return Object.entries(value).reduce((payload, [key, item]) => {
    if (item === undefined) return payload;
    payload[key] = compactAnalyticsPayload(item);
    return payload;
  }, {});
}

function resolveAnalyticsEventDefinition(eventNameOrKey) {
  return (
    FIREBASE_ANALYTICS_EVENTS[eventNameOrKey] ||
    Object.values(FIREBASE_ANALYTICS_EVENTS).find((definition) => definition.eventName === eventNameOrKey)
  );
}

export async function trackAnalyticsEvent(eventNameOrKey, data = {}, options = {}) {
  const definition = resolveAnalyticsEventDefinition(eventNameOrKey);
  if (!definition) throw new Error(`Unknown analytics event: ${eventNameOrKey}`);

  const user = auth.currentUser;
  const uid = options.uid || user?.uid || "";
  const eventPayload = {
    eventName: definition.eventName,
    uid,
    email: options.email || user?.email || "",
    role: options.role || "",
    sessionId: options.sessionId || "",
    anonymousId: options.anonymousId || "",
    source: options.source || "mobile",
    platform: options.platform || "",
    appVersion: options.appVersion || "",
    occurredAt: options.occurredAt || serverTimestamp(),
    createdAt: serverTimestamp(),
    context: compactAnalyticsPayload(options.context || {}),
    data: compactAnalyticsPayload(data || {}),
  };

  const analyticsRef = doc(collection(db, FIREBASE_COLLECTIONS.analyticsEvents));
  const eventRef = doc(collection(db, definition.collection));
  const batch = writeBatch(db);

  batch.set(analyticsRef, eventPayload);
  batch.set(eventRef, {
    ...eventPayload,
    analyticsEventId: analyticsRef.id,
  });
  await batch.commit();

  return { id: analyticsRef.id, eventName: definition.eventName, collection: definition.collection };
}

export function subscribeToCommunityMessages(onMessages, onError) {
  const messagesQuery = query(collection(db, COMMUNITY_MESSAGES_COLLECTION), orderBy("createdAt", "desc"), limit(50));
  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      const messages = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter(isCommunityMessageVisible)
        .reverse();
      onMessages(messages);
    },
    onError,
  );
}

// Get total count of community messages (uses Firestore count aggregation)
export async function getCommunityMessagesCount() {
  try {
    const snapshot = await getCountFromServer(query(collection(db, COMMUNITY_MESSAGES_COLLECTION)));
    return snapshot.data().count || 0;
  } catch (error) {
    // fallback: return 0 on error
    return 0;
  }
}

// Fetch the latest page of messages (most recent `pageSize`), returns messages (asc order) and the last visible doc for pagination
export async function fetchLatestCommunityMessages(pageSize = 20) {
  const q = query(collection(db, COMMUNITY_MESSAGES_COLLECTION), orderBy("createdAt", "desc"), limit(pageSize));
  const snapshot = await getDocs(q);
  const messages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).filter(isCommunityMessageVisible).reverse();
  const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
  return { messages, lastVisible };
}

// Fetch older messages after the provided `lastVisible` (DocumentSnapshot) in pages of `pageSize`
export async function fetchCommunityMessagesBefore(lastVisible, pageSize = 20) {
  if (!lastVisible) return { messages: [], lastVisible: null, hasMore: false };
  const q = query(collection(db, COMMUNITY_MESSAGES_COLLECTION), orderBy("createdAt", "desc"), startAfter(lastVisible), limit(pageSize));
  const snapshot = await getDocs(q);
  const messages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).filter(isCommunityMessageVisible).reverse();
  const newLastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
  return { messages, lastVisible: newLastVisible, hasMore: snapshot.size === pageSize };
}

// Subscribe to only the newest message in real-time (useful to append incoming messages)
export function subscribeToNewCommunityMessages(onNewMessage, onError) {
  const q = query(collection(db, COMMUNITY_MESSAGES_COLLECTION), orderBy("createdAt", "desc"), limit(1));
  return onSnapshot(
    q,
    (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).filter(isCommunityMessageVisible);
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
    const q = query(collection(db, FIREBASE_COLLECTIONS.userPrograms), where(field, "==", identifier));
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
    readDoc(FIREBASE_COLLECTIONS.users, currentUid),
    readDoc(FIREBASE_COLLECTIONS.profiles, currentUid),
    readDoc(FIREBASE_COLLECTIONS.subscriptions, currentUid),
    readDoc(FIREBASE_COLLECTIONS.users, currentEmail),
    readQuery(FIREBASE_COLLECTIONS.userSubscriptions, "uid", currentUid),
    readQuery(FIREBASE_COLLECTIONS.userSubscriptions, "email", currentEmail),
    readQuery(FIREBASE_COLLECTIONS.subscriptions, "uid", currentUid),
    readQuery(FIREBASE_COLLECTIONS.subscriptions, "email", currentEmail),
  ]);

  return records;
}

function requireCurrentUser() {
  const user = auth.currentUser;
  if (!user?.uid) throw new Error("Not authenticated");
  return user;
}

export async function getUserProfile(uid = auth.currentUser?.uid) {
  if (!uid) return null;
  const snapshot = await getDoc(doc(db, FIREBASE_COLLECTIONS.users, uid, FIREBASE_SUBCOLLECTIONS.userProfile, FIREBASE_DOCUMENTS.mainSettings));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export function subscribeToUserProfile(onProfile, onError, uid = auth.currentUser?.uid) {
  if (!uid) return () => {};
  return onSnapshot(
    doc(db, FIREBASE_COLLECTIONS.users, uid, FIREBASE_SUBCOLLECTIONS.userProfile, FIREBASE_DOCUMENTS.mainSettings),
    (snapshot) => onProfile(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    onError,
  );
}

export async function saveUserProfile(profile = {}) {
  const user = requireCurrentUser();
  const cleanProfile = {
    name: profile.name || user.displayName || "Ratnica",
    goal: profile.goal || "",
    email: user.email || profile.email || "",
    age: profile.age || "",
    level: profile.level || "",
  };

  await setDoc(
    doc(db, FIREBASE_COLLECTIONS.users, user.uid, FIREBASE_SUBCOLLECTIONS.userProfile, FIREBASE_DOCUMENTS.mainSettings),
    {
      ...cleanProfile,
      uid: user.uid,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await setDoc(
    doc(db, FIREBASE_COLLECTIONS.users, user.uid),
    {
      uid: user.uid,
      email: user.email || profile.email || "",
      displayName: cleanProfile.name,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return cleanProfile;
}

export async function saveUserProgress(programId, progress = {}) {
  const user = requireCurrentUser();
  if (!programId) throw new Error("Missing program id");

  return setDoc(
    doc(db, FIREBASE_COLLECTIONS.users, user.uid, FIREBASE_SUBCOLLECTIONS.userProgress, String(programId)),
    {
      ...progress,
      uid: user.uid,
      programId: String(programId),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
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
    const q = query(collection(db, COMMUNITY_MESSAGES_COLLECTION, messageId, FIREBASE_SUBCOLLECTIONS.messageLikes));
    const snap = await getCountFromServer(q);
    return snap.data().count || 0;
  } catch (err) {
    return 0;
  }
}

export async function toggleMessageLike(messageId) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");
  const likeRef = doc(db, COMMUNITY_MESSAGES_COLLECTION, messageId, FIREBASE_SUBCOLLECTIONS.messageLikes, uid);
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
  const q = query(collection(db, COMMUNITY_MESSAGES_COLLECTION, messageId, FIREBASE_SUBCOLLECTIONS.messageLikes));
  return onSnapshot(
    q,
    (snapshot) => onChange(snapshot.size),
    onError,
  );
}

function isCommunityMessageVisible(message) {
  const visibility = String(message?.visibility || "visible").toLowerCase();
  const moderationStatus = String(message?.moderationStatus || "").toLowerCase();
  const status = String(message?.status || "").toLowerCase();
  return !HIDDEN_MESSAGE_STATES.has(visibility) && !HIDDEN_MESSAGE_STATES.has(moderationStatus) && !HIDDEN_MESSAGE_STATES.has(status);
}

export async function toggleMessageReaction(messageId, emoji) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");
  if (!messageId || !emoji) throw new Error("Missing reaction");

  const messageRef = doc(db, COMMUNITY_MESSAGES_COLLECTION, messageId);
  const reactionRef = doc(db, COMMUNITY_MESSAGES_COLLECTION, messageId, FIREBASE_SUBCOLLECTIONS.messageReactions, uid);

  return runTransaction(db, async (transaction) => {
    const reactionSnap = await transaction.get(reactionRef);
    const previousEmoji = reactionSnap.exists() ? reactionSnap.data()?.emoji : "";
    const removingSameReaction = previousEmoji === emoji;
    const aggregateUpdate = {
      reactionUpdatedAt: serverTimestamp(),
    };

    if (previousEmoji) {
      aggregateUpdate[`reactionCounts.${previousEmoji}`] = increment(-1);
    }

    if (removingSameReaction) {
      transaction.delete(reactionRef);
      transaction.update(messageRef, aggregateUpdate);
      return { emoji: "", previousEmoji };
    }

    aggregateUpdate[`reactionCounts.${emoji}`] = increment(1);
    transaction.set(
      reactionRef,
      {
        uid,
        emoji,
        updatedAt: serverTimestamp(),
        createdAt: reactionSnap.exists() ? reactionSnap.data()?.createdAt || serverTimestamp() : serverTimestamp(),
      },
      { merge: true },
    );
    transaction.update(messageRef, aggregateUpdate);
    return { emoji, previousEmoji };
  });
}

export function subscribeToMessageReactions(messageId, onChange, onError) {
  const uid = auth.currentUser?.uid || "";
  const reactionsQuery = query(collection(db, COMMUNITY_MESSAGES_COLLECTION, messageId, FIREBASE_SUBCOLLECTIONS.messageReactions));
  return onSnapshot(
    reactionsQuery,
    (snapshot) => {
      const counts = {};
      let myReaction = "";
      snapshot.docs.forEach((reactionDoc) => {
        const data = reactionDoc.data();
        const emoji = data?.emoji;
        if (!emoji) return;
        counts[emoji] = (counts[emoji] || 0) + 1;
        if (reactionDoc.id === uid || data.uid === uid) {
          myReaction = emoji;
        }
      });
      onChange({ counts, myReaction });
    },
    onError,
  );
}

export function sendCommunityMessage({ text, user, attachments = [] }) {
  const cleanText = (text || "").trim();
  if (!cleanText && (!attachments || attachments.length === 0)) return Promise.resolve();

  return addDoc(collection(db, COMMUNITY_MESSAGES_COLLECTION), {
    schemaVersion: 2,
    contentType: "globalChatMessage",
    text: cleanText,
    attachments,
    name: user?.name || "Ratnica",
    email: user?.email || "",
    uid: auth.currentUser?.uid || "",
    visibility: "visible",
    moderationStatus: "pendingReview",
    reviewStatus: "pending",
    reportCount: 0,
    reactionCounts: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
