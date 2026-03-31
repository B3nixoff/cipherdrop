"use client";

import { LoaderCircle } from "lucide-react";
import { startTransition, useEffect, useMemo, useState } from "react";

import { SecureChat } from "@/components/secure-chat";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ensureAuthenticatedUser } from "@/lib/firebase/auth";
import { getFirebaseServices } from "@/lib/firebase/client";
import {
  ensureExistingProfile,
  getProfileById,
  joinRoomByInvite,
  subscribeToRoom,
} from "@/lib/firebase/queries";
import { useIsClient } from "@/lib/hooks/use-is-client";

type SecureChatShellProps = {
  roomId: string;
};

export function SecureChatShell({ roomId }: SecureChatShellProps) {
  const isClient = useIsClient();
  const services = useMemo(
    () => (isClient ? getFirebaseServices() : null),
    [isClient],
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [participantAId, setParticipantAId] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState("you");
  const [counterpart, setCounterpart] = useState<{
    id: string;
    username: string;
    publicKey: string;
  } | null>(null);
  const [status, setStatus] = useState("Preparing secure invite session...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!services) {
      return;
    }

    let active = true;

    startTransition(() => {
      void (async () => {
        try {
          const user = await ensureAuthenticatedUser();
          const profile = await ensureExistingProfile(
            services.firestore,
            services.database,
            user,
          );
          const room = await joinRoomByInvite(services.firestore, roomId, user.uid);

          if (!active) {
            return;
          }

          setCurrentUserId(user.uid);
          setParticipantAId(room.participant_a);
          setMyUsername(profile.username);
          setStatus(
            room.participant_b
              ? "Secure room ready."
              : "Secure room created. Share the invite link and wait for the second participant.",
          );
        } catch (caughtError) {
          if (active) {
            setError(
              caughtError instanceof Error
                ? caughtError.message
                : "Unable to initialize the secure room.",
            );
          }
        }
      })();
    });

    return () => {
      active = false;
    };
  }, [roomId, services]);

  useEffect(() => {
    if (!services || !currentUserId) {
      return;
    }

    return subscribeToRoom(services.firestore, roomId, (room) => {
      if (!room) {
        setError("Secure room not found.");
        return;
      }

      setParticipantAId(room.participant_a);

      const counterpartId =
        room.participant_a === currentUserId ? room.participant_b : room.participant_a;

      if (!counterpartId) {
        setCounterpart(null);
        setStatus("Secure room created. Share the invite link and wait for the second participant.");
        return;
      }

      void (async () => {
        const counterpartProfile = await getProfileById(services.firestore, counterpartId);
        if (!counterpartProfile) {
          setCounterpart(null);
          setStatus("Participant detected, waiting for their public key profile.");
          return;
        }

        setCounterpart({
          id: counterpartProfile.id,
          username: counterpartProfile.username,
          publicKey: counterpartProfile.public_key,
        });
        setStatus("Secure room ready.");
      })();
    });
  }, [currentUserId, roomId, services]);

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-4 sm:px-6 sm:py-6">
      <div className="pointer-events-none absolute inset-0 grid-noise opacity-35" />
      {error ? (
        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-2rem)] max-w-2xl items-center">
          <Card className="w-full p-8">
            <h1 className="text-2xl font-semibold">Secure room unavailable</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{error}</p>
            <Button className="mt-6" onClick={() => window.location.assign("/")}>
              Return home
            </Button>
          </Card>
        </div>
      ) : currentUserId ? (
        <SecureChat
          roomId={roomId}
          currentUserId={currentUserId}
          participantAId={participantAId}
          myUsername={myUsername}
          counterpart={counterpart}
        />
      ) : (
        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-2rem)] max-w-2xl items-center">
          <Card className="flex w-full items-center gap-4 p-8">
            <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
            <div>
              <h1 className="text-xl font-semibold">Joining secure room</h1>
              <p className="mt-2 text-sm text-muted-foreground">{status}</p>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
