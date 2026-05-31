import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";

import { auth, db } from "../firebaseConfig";
import { requireCurrentUser } from "./authService";

export type UserProgress = DocumentData & {
  id?: string;
  uid?: string;
  programId: string;
  updatedAt?: unknown;
};

function userProgressRef(uid: string, programId: string) {
  return doc(db, "users", uid, "progress", String(programId));
}

export async function getUserProgress(programId: string, uid = auth.currentUser?.uid): Promise<UserProgress | null> {
  if (!uid || !programId) return null;
  const snapshot = await getDoc(userProgressRef(uid, programId));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as UserProgress) : null;
}

export function subscribeToUserProgress(
  programId: string,
  onProgress: (progress: UserProgress | null) => void,
  onError?: (error: FirestoreError) => void,
  uid = auth.currentUser?.uid,
): Unsubscribe {
  if (!uid || !programId) return () => {};
  return onSnapshot(
    userProgressRef(uid, programId),
    (snapshot) => onProgress(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as UserProgress) : null),
    onError,
  );
}

export async function saveUserProgress(programId: string, progress: Record<string, unknown> = {}): Promise<void> {
  const user = requireCurrentUser();
  if (!programId) throw new Error("Missing program id");

  await setDoc(
    userProgressRef(user.uid, programId),
    {
      ...progress,
      uid: user.uid,
      programId: String(programId),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
