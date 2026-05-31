import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
  type FirestoreError,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "../firebaseConfig";

const APP_CONTENT_COLLECTION = "appContent";
const APP_CONTENT_DOCUMENT = "sanctuary";

export type AppContentManifest = {
  schemaVersion?: number;
  modelVersion?: number;
  contentVersion?: string;
  sectionVersions: Record<string, string>;
  cache?: unknown;
  updatedAt?: unknown;
};

export type AppContent = AppContentManifest & {
  images?: Record<string, string>;
  programs?: AppProgram[];
  communityPosts?: DocumentData[];
  potions?: DocumentData[];
  navItems?: DocumentData[];
  settings?: DocumentData;
};

export type AppProgram = DocumentData & {
  id?: string;
  title?: string;
  category?: string;
  image?: string;
  imageUrl?: string;
  img?: string;
};

export type UserProgram = DocumentData & {
  id: string;
  uid?: string;
  email?: string;
  title?: string;
};

function appContentRef() {
  return doc(db, APP_CONTENT_COLLECTION, APP_CONTENT_DOCUMENT);
}

function appContentCollectionRef(collectionName: string) {
  return collection(db, APP_CONTENT_COLLECTION, APP_CONTENT_DOCUMENT, collectionName);
}

function appContentDocRef(collectionName: string, documentId: string) {
  return doc(db, APP_CONTENT_COLLECTION, APP_CONTENT_DOCUMENT, collectionName, documentId);
}

function withId<T extends DocumentData>(contentDoc: QueryDocumentSnapshot<T>): T & { id: string } {
  return {
    id: contentDoc.id,
    ...contentDoc.data(),
  };
}

async function getOrderedAppContentDocs(collectionName: string) {
  const snapshot = await getDocs(query(appContentCollectionRef(collectionName), orderBy("order", "asc")));
  return snapshot.docs.map(withId);
}

export function subscribeToAppContent(
  onContent: (content: (DocumentData & { id: string }) | null) => void,
  onError?: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    appContentRef(),
    (snapshot) => {
      onContent(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
    },
    onError,
  );
}

export async function fetchAppContentManifest(): Promise<AppContentManifest | null> {
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

export async function fetchAppContent(): Promise<AppContent> {
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
  const images = imageDocs.reduce<Record<string, string>>((acc, item) => {
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
    programs: (programDocs.length ? programDocs : root.programs || root.allPrograms) as AppProgram[],
    communityPosts: communityPostDocs.length ? communityPostDocs : root.communityPosts,
    potions: potionDocs.length ? potionDocs : root.potions,
    navItems: navDocs.length ? navDocs : root.navItems,
    settings: settingsSnapshot.exists() ? settingsSnapshot.data() : root.settings,
    updatedAt: root.updatedAt,
  };
}

export async function uploadAppContent(content: Record<string, unknown>): Promise<void> {
  if (!content || typeof content !== "object") {
    throw new Error("Missing app content payload.");
  }

  await setDoc(
    appContentRef(),
    {
      ...content,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function getUserActivePrograms(identifier: string): Promise<UserProgram[]> {
  if (!identifier) return [];
  try {
    const field = identifier.includes("@") ? "email" : "uid";
    const programsQuery = query(collection(db, "userPrograms"), where(field, "==", identifier), limit(50));
    const snapshot = await getDocs(programsQuery);
    return snapshot.docs.map(withId) as UserProgram[];
  } catch (error) {
    return [];
  }
}
