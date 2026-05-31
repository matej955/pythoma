import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
  type UserCredential,
} from "firebase/auth";

import { auth } from "../firebaseConfig";

export type RegisterWithEmailParams = {
  email: string;
  password: string;
  name?: string;
};

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

export function requireCurrentUser(): User {
  const user = auth.currentUser;
  if (!user?.uid) throw new Error("Not authenticated");
  return user;
}

export async function loginWithEmail(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function registerWithEmail({ email, password, name }: RegisterWithEmailParams): Promise<UserCredential> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (name) {
    await updateProfile(credential.user, { displayName: name });
  }
  return credential;
}

export async function loginWithGoogleIdToken(idToken: string): Promise<UserCredential> {
  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
}

export function logout(): Promise<void> {
  return signOut(auth);
}
