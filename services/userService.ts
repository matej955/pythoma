import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";

import { auth, db } from "../firebaseConfig";
import { requireCurrentUser } from "./authService";

export type UserProfile = {
  id?: string;
  uid?: string;
  name: string;
  goal: string;
  email: string;
  age: string;
  level: string;
  updatedAt?: unknown;
};

export type SubscriptionRecord = DocumentData & {
  id: string;
  source: string;
};

export async function getUserSubscription({ uid, email }: { uid?: string; email?: string } = {}): Promise<SubscriptionRecord[]> {
  const currentUid = uid || auth.currentUser?.uid || "";
  const currentEmail = email || auth.currentUser?.email || "";
  const records: SubscriptionRecord[] = [];

  async function readDoc(collectionName: string, id: string) {
    if (!id || id.includes("/")) return;
    try {
      const snapshot = await getDoc(doc(db, collectionName, id));
      if (snapshot.exists()) {
        records.push({ id: snapshot.id, source: collectionName, ...snapshot.data() });
      }
    } catch (error) {
      // Keep checking other entitlement locations.
    }
  }

  async function readQuery(collectionName: string, field: string, value: string) {
    if (!value) return;
    try {
      const snapshot = await getDocs(query(collection(db, collectionName), where(field, "==", value), limit(5)));
      snapshot.docs.forEach((subscriptionDoc) => {
        records.push({ id: subscriptionDoc.id, source: collectionName, ...subscriptionDoc.data() });
      });
    } catch (error) {
      // Keep checking other entitlement locations.
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

export async function getUserProfile(uid = auth.currentUser?.uid): Promise<UserProfile | null> {
  if (!uid) return null;
  const snapshot = await getDoc(doc(db, "users", uid, "profile", "main"));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as UserProfile) : null;
}

export function subscribeToUserProfile(
  onProfile: (profile: UserProfile | null) => void,
  onError?: (error: FirestoreError) => void,
  uid = auth.currentUser?.uid,
): Unsubscribe {
  if (!uid) return () => {};
  return onSnapshot(
    doc(db, "users", uid, "profile", "main"),
    (snapshot) => onProfile(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as UserProfile) : null),
    onError,
  );
}

export async function saveUserProfile(profile: Partial<UserProfile> = {}): Promise<UserProfile> {
  const user = requireCurrentUser();
  const cleanProfile: UserProfile = {
    name: profile.name || user.displayName || "Ratnica",
    goal: profile.goal || "",
    email: user.email || profile.email || "",
    age: profile.age || "",
    level: profile.level || "",
  };

  await setDoc(
    doc(db, "users", user.uid, "profile", "main"),
    {
      ...cleanProfile,
      uid: user.uid,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await setDoc(
    doc(db, "users", user.uid),
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
