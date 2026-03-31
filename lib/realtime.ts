import {
  get,
  onDisconnect,
  onChildAdded,
  onValue,
  push,
  ref,
  remove,
  runTransaction,
  set,
  type Database,
} from "firebase/database";
import type { RealtimeEvent } from "@/lib/types";

function getUsernameLeaseKey(username: string) {
  return encodeURIComponent(username.trim().toLowerCase());
}

export async function registerPresence(
  database: Database,
  roomId: string,
  userId: string,
  username: string,
) {
  const presenceRef = ref(database, `presence/${roomId}/${userId}`);
  await set(presenceRef, {
    username,
    joinedAt: Date.now(),
  });
  await onDisconnect(presenceRef).remove();

  return () => remove(presenceRef);
}

export function subscribeToPresence(
  database: Database,
  roomId: string,
  callback: (userIds: string[]) => void,
) {
  const roomPresenceRef = ref(database, `presence/${roomId}`);
  return onValue(roomPresenceRef, (snapshot) => {
    const value = snapshot.val() as Record<string, unknown> | null;
    callback(value ? Object.keys(value) : []);
  });
}

export async function sendRoomEvent({
  database,
  roomId,
  event,
}: {
  database: Database;
  roomId: string;
  event: RealtimeEvent;
}) {
  const eventRef = push(ref(database, `events/${roomId}`));
  await set(eventRef, event);
}

export function subscribeToRoomEvents(
  database: Database,
  roomId: string,
  currentUserId: string,
  callback: (event: RealtimeEvent) => void,
) {
  const roomEventsRef = ref(database, `events/${roomId}`);

  return onChildAdded(roomEventsRef, async (snapshot) => {
    const event = snapshot.val() as RealtimeEvent | null;

    if (!event) {
      return;
    }

    if (event.senderId !== currentUserId) {
      callback(event);
    }

    await remove(snapshot.ref);
  });
}

export async function clearRoomEvents(database: Database, roomId: string) {
  const roomEventsRef = ref(database, `events/${roomId}`);
  const snapshot = await get(roomEventsRef);

  if (!snapshot.exists()) {
    return;
  }

  await remove(roomEventsRef);
}

export async function claimUsernameLease(
  database: Database,
  username: string,
  userId: string,
) {
  const normalized = username.trim().toLowerCase();
  const leaseRef = ref(database, `usernames/${getUsernameLeaseKey(normalized)}`);

  const transactionResult = await runTransaction(
    leaseRef,
    (currentValue: { userId?: string } | null) => {
      if (!currentValue || currentValue.userId === userId) {
        return {
          userId,
          username: normalized,
          claimedAt: Date.now(),
        };
      }

      return undefined;
    },
    { applyLocally: false },
  );

  if (!transactionResult.committed) {
    throw new Error("This username is already taken.");
  }

  await onDisconnect(leaseRef).remove();
  return normalized;
}

export async function releaseUsernameLease(
  database: Database,
  username: string,
  userId: string,
) {
  const leaseRef = ref(database, `usernames/${getUsernameLeaseKey(username)}`);
  const snapshot = await get(leaseRef);
  const value = snapshot.val() as { userId?: string } | null;

  if (!value || value.userId !== userId) {
    return;
  }

  await remove(leaseRef);
}

export async function usernameExists(database: Database, username: string) {
  const normalized = username.trim().toLowerCase();
  const leaseRef = ref(database, `usernames/${getUsernameLeaseKey(normalized)}`);
  const snapshot = await get(leaseRef);
  return snapshot.exists();
}
