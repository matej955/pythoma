import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  type DocumentData,
  type FirestoreError,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";

import { auth, db } from "../firebaseConfig";

const HIDDEN_MESSAGE_STATES = new Set(["hidden", "removed", "blocked"]);

export type CommunityMessage = DocumentData & {
  id: string;
  text?: string;
  name?: string;
  email?: string;
  uid?: string;
  attachments?: CommunityAttachment[];
  reactionCounts?: Record<string, number>;
  createdAt?: unknown;
};

export type CommunityAttachment = DocumentData & {
  id?: string;
  type: string;
};

export type CommunityMessagesPage = {
  messages: CommunityMessage[];
  lastVisible: QueryDocumentSnapshot<DocumentData> | null;
  hasMore?: boolean;
};

export type MessageReactionState = {
  counts: Record<string, number>;
  myReaction: string;
};

function withId(contentDoc: QueryDocumentSnapshot<DocumentData>): CommunityMessage {
  return {
    id: contentDoc.id,
    ...contentDoc.data(),
  };
}

function isCommunityMessageVisible(message: DocumentData): boolean {
  const visibility = String(message?.visibility || "visible").toLowerCase();
  const moderationStatus = String(message?.moderationStatus || "").toLowerCase();
  const status = String(message?.status || "").toLowerCase();
  return !HIDDEN_MESSAGE_STATES.has(visibility) && !HIDDEN_MESSAGE_STATES.has(moderationStatus) && !HIDDEN_MESSAGE_STATES.has(status);
}

export function subscribeToCommunityMessages(
  onMessages: (messages: CommunityMessage[]) => void,
  onError?: (error: FirestoreError) => void,
): Unsubscribe {
  const messagesQuery = query(collection(db, "communityMessages"), orderBy("createdAt", "desc"), limit(50));
  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      const messages = snapshot.docs.map(withId).filter(isCommunityMessageVisible).reverse();
      onMessages(messages);
    },
    onError,
  );
}

export async function getCommunityMessagesCount(): Promise<number> {
  try {
    const snapshot = await getCountFromServer(query(collection(db, "communityMessages")));
    return snapshot.data().count || 0;
  } catch (error) {
    return 0;
  }
}

export async function fetchLatestCommunityMessages(pageSize = 20): Promise<CommunityMessagesPage> {
  const messagesQuery = query(collection(db, "communityMessages"), orderBy("createdAt", "desc"), limit(pageSize));
  const snapshot = await getDocs(messagesQuery);
  const messages = snapshot.docs.map(withId).filter(isCommunityMessageVisible).reverse();
  const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
  return { messages, lastVisible };
}

export async function fetchCommunityMessagesBefore(
  lastVisible: QueryDocumentSnapshot<DocumentData> | null,
  pageSize = 20,
): Promise<CommunityMessagesPage> {
  if (!lastVisible) return { messages: [], lastVisible: null, hasMore: false };

  const messagesQuery = query(collection(db, "communityMessages"), orderBy("createdAt", "desc"), startAfter(lastVisible), limit(pageSize));
  const snapshot = await getDocs(messagesQuery);
  const messages = snapshot.docs.map(withId).filter(isCommunityMessageVisible).reverse();
  const newLastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
  return { messages, lastVisible: newLastVisible, hasMore: snapshot.size === pageSize };
}

export function subscribeToNewCommunityMessages(
  onNewMessage: (message: CommunityMessage) => void,
  onError?: (error: FirestoreError) => void,
): Unsubscribe {
  const messagesQuery = query(collection(db, "communityMessages"), orderBy("createdAt", "desc"), limit(1));
  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      const docs = snapshot.docs.map(withId).filter(isCommunityMessageVisible);
      const newest = docs[0];
      if (newest) onNewMessage(newest);
    },
    onError,
  );
}

export async function getLikesCount(messageId: string): Promise<number> {
  try {
    const likesQuery = query(collection(db, "communityMessages", messageId, "likes"));
    const snapshot = await getCountFromServer(likesQuery);
    return snapshot.data().count || 0;
  } catch (error) {
    return 0;
  }
}

export async function toggleMessageLike(messageId: string): Promise<{ liked: boolean }> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");

  const likeRef = doc(db, "communityMessages", messageId, "likes", uid);
  const likeSnap = await getDoc(likeRef);
  if (likeSnap.exists()) {
    await deleteDoc(likeRef);
    return { liked: false };
  }

  await setDoc(likeRef, { uid, createdAt: serverTimestamp() });
  return { liked: true };
}

export function subscribeToMessageLikes(
  messageId: string,
  onChange: (likesCount: number) => void,
  onError?: (error: FirestoreError) => void,
): Unsubscribe {
  const likesQuery = query(collection(db, "communityMessages", messageId, "likes"));
  return onSnapshot(
    likesQuery,
    (snapshot) => onChange(snapshot.size),
    onError,
  );
}

export async function toggleMessageReaction(messageId: string, emoji: string): Promise<{ emoji: string; previousEmoji: string }> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");
  if (!messageId || !emoji) throw new Error("Missing reaction");

  const messageRef = doc(db, "communityMessages", messageId);
  const reactionRef = doc(db, "communityMessages", messageId, "reactions", uid);

  return runTransaction(db, async (transaction) => {
    const reactionSnap = await transaction.get(reactionRef);
    const previousEmoji = reactionSnap.exists() ? reactionSnap.data()?.emoji : "";
    const removingSameReaction = previousEmoji === emoji;
    const aggregateUpdate: Record<string, unknown> = {
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

export function subscribeToMessageReactions(
  messageId: string,
  onChange: (state: MessageReactionState) => void,
  onError?: (error: FirestoreError) => void,
): Unsubscribe {
  const uid = auth.currentUser?.uid || "";
  const reactionsQuery = query(collection(db, "communityMessages", messageId, "reactions"));
  return onSnapshot(
    reactionsQuery,
    (snapshot) => {
      const counts: Record<string, number> = {};
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

export function sendCommunityMessage({
  text,
  user,
  attachments = [],
}: {
  text: string;
  user?: { name?: string; email?: string };
  attachments?: CommunityAttachment[];
}) {
  const cleanText = (text || "").trim();
  if (!cleanText && (!attachments || attachments.length === 0)) return Promise.resolve();

  return addDoc(collection(db, "communityMessages"), {
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
