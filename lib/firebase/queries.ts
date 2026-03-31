import type { User } from "firebase/auth";
import type { Database } from "firebase/database";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";

import { exportPublicKey, getOrCreateIdentityKeyPair } from "@/lib/crypto";
import { claimUsernameLease } from "@/lib/realtime";
import type { ProfileRow, RoomRow } from "@/lib/types";

export async function ensureProfile(
  firestore: Firestore,
  user: User,
  username: string,
) {
  const keyPair = await getOrCreateIdentityKeyPair();
  const publicKey = await exportPublicKey(keyPair.publicKey);

  const profile: ProfileRow = {
    id: user.uid,
    username,
    public_key: publicKey,
    created_at: new Date().toISOString(),
  };

  await setDoc(doc(firestore, "profiles", user.uid), {
    ...profile,
    createdAt: serverTimestamp(),
  });

  return profile;
}

export async function deleteProfileById(firestore: Firestore, userId: string) {
  await deleteDoc(doc(firestore, "profiles", userId));
}

export async function getMyProfile(firestore: Firestore, userId: string) {
  const snapshot = await getDoc(doc(firestore, "profiles", userId));
  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();
  return {
    id: snapshot.id,
    username: data.username,
    public_key: data.public_key,
    created_at: data.createdAt?.toDate?.()?.toISOString?.() ?? undefined,
  } as ProfileRow;
}

export async function getProfileById(firestore: Firestore, userId: string) {
  return getMyProfile(firestore, userId);
}

export async function ensureExistingProfile(
  firestore: Firestore,
  database: Database,
  user: User,
  preferredUsername?: string,
) {
  const existing = await getMyProfile(firestore, user.uid);
  if (existing) {
    await claimUsernameLease(database, existing.username, user.uid);
    return existing;
  }

  const generatedUsername =
    preferredUsername?.trim().toLowerCase() || `guest-${user.uid.slice(0, 8)}`;

  await claimUsernameLease(database, generatedUsername, user.uid);
  return ensureProfile(firestore, user, generatedUsername);
}

export async function createInviteRoom(
  firestore: Firestore,
  userId: string,
) {
  const roomRef = await addDoc(collection(firestore, "rooms"), {
    participantA: userId,
    participantB: null,
    active: false,
    createdAt: serverTimestamp(),
  });

  return {
    id: roomRef.id,
    participant_a: userId,
    participant_b: null,
    active: false,
  } as RoomRow;
}

export async function getRoomById(firestore: Firestore, roomId: string) {
  const snapshot = await getDoc(doc(firestore, "rooms", roomId));
  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();
  return {
    id: snapshot.id,
    participant_a: data.participantA,
    participant_b: data.participantB ?? null,
    active: Boolean(data.active),
    created_at: data.createdAt?.toDate?.()?.toISOString?.() ?? undefined,
  } as RoomRow;
}

export async function joinRoomByInvite(
  firestore: Firestore,
  roomId: string,
  userId: string,
) {
  const roomRef = doc(firestore, "rooms", roomId);

  return runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) {
      throw new Error("Secure room not found.");
    }

    const data = snapshot.data();
    const participantA = data.participantA as string;
    const participantB = (data.participantB as string | null | undefined) ?? null;

    if (participantA === userId || participantB === userId) {
      return {
        id: snapshot.id,
        participant_a: participantA,
        participant_b: participantB,
        active: Boolean(data.active),
      } as RoomRow;
    }

    if (participantB) {
      throw new Error("This secure room already has two participants.");
    }

    transaction.update(roomRef, {
      participantB: userId,
      active: true,
    });

    return {
      id: snapshot.id,
      participant_a: participantA,
      participant_b: userId,
      active: true,
    } as RoomRow;
  });
}

export async function markRoomInactive(firestore: Firestore, roomId: string) {
  await updateDoc(doc(firestore, "rooms", roomId), {
    active: false,
  });
}

export async function clearRoomSignals(firestore: Firestore, roomId: string) {
  const snapshot = await getDocs(collection(firestore, "rooms", roomId, "signals"));
  await Promise.all(snapshot.docs.map((signalDoc) => deleteDoc(signalDoc.ref)));
}

export function subscribeToRoom(
  firestore: Firestore,
  roomId: string,
  callback: (room: RoomRow | null) => void,
) {
  return onSnapshot(doc(firestore, "rooms", roomId), (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }

    const data = snapshot.data();
    callback({
      id: snapshot.id,
      participant_a: data.participantA,
      participant_b: data.participantB ?? null,
      active: Boolean(data.active),
      created_at: data.createdAt?.toDate?.()?.toISOString?.() ?? undefined,
    } as RoomRow);
  });
}

export type SignalEnvelope = {
  type: "offer" | "answer" | "ice-candidate";
  senderId: string;
  payload: Record<string, unknown>;
  createdAt?: unknown;
};

export async function sendSignal(
  firestore: Firestore,
  roomId: string,
  signal: SignalEnvelope,
) {
  await addDoc(collection(firestore, "rooms", roomId, "signals"), {
    ...signal,
    createdAt: serverTimestamp(),
  });
}

export function subscribeToSignals(
  firestore: Firestore,
  roomId: string,
  callback: (signalId: string, signal: SignalEnvelope) => void,
) {
  return onSnapshot(
    query(
      collection(firestore, "rooms", roomId, "signals"),
      orderBy("createdAt", "asc"),
      limit(50),
    ),
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type !== "added") {
          return;
        }

        const data = change.doc.data() as SignalEnvelope;
        callback(change.doc.id, data);
      });
    },
  );
}
