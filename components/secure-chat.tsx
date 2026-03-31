"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, Bug, Copy, Link2, LoaderCircle } from "lucide-react";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import { ChatComposer } from "@/components/chat-composer";
import { MessageList } from "@/components/message-list";
import { SessionEndedDialog } from "@/components/session-ended-dialog";
import { SessionHeader } from "@/components/session-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  decryptMessage,
  deriveSharedKey,
  encryptMessage,
  getOrCreateIdentityKeyPair,
  importPublicKey,
} from "@/lib/crypto";
import { deleteCurrentAnonymousUser } from "@/lib/firebase/auth";
import { getFirebaseServices } from "@/lib/firebase/client";
import {
  deleteProfileById,
  markRoomInactive,
} from "@/lib/firebase/queries";
import {
  clearRoomEvents,
  releaseUsernameLease,
  registerPresence,
  sendRoomEvent,
  subscribeToPresence,
  subscribeToRoomEvents,
} from "@/lib/realtime";
import { createSystemMessage, wipeMessages } from "@/lib/session-store";
import { useIsClient } from "@/lib/hooks/use-is-client";
import type {
  ChatContent,
  RealtimeEncryptedPayload,
  RealtimeEvent,
  SessionMessage,
} from "@/lib/types";

type SecureChatProps = {
  roomId: string;
  currentUserId: string;
  participantAId: string | null;
  myUsername: string;
  counterpart: {
    id: string;
    username: string;
    publicKey: string;
  } | null;
};

export function SecureChat({
  roomId,
  currentUserId,
  participantAId,
  myUsername,
  counterpart,
}: SecureChatProps) {
  const router = useRouter();
  const isClient = useIsClient();
  const services = useMemo(
    () => (isClient ? getFirebaseServices() : null),
    [isClient],
  );
  const sharedKeyRef = useRef<CryptoKey | null>(null);
  const participantSeenRef = useRef(false);
  const cleanupStartedRef = useRef(false);

  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [lastPayload, setLastPayload] = useState<RealtimeEncryptedPayload | null>(
    null,
  );
  const [sharedKeyReady, setSharedKeyReady] = useState(false);
  const [isRemoteOnline, setIsRemoteOnline] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [sessionDescription, setSessionDescription] = useState(
    "The secure session is currently inactive.",
  );
  const [error, setError] = useState<string | null>(null);
  const inviteLink = isClient ? `${window.location.origin}/chat/${roomId}` : "";
  const hasRemoteParticipant = Boolean(counterpart);
  const hasDerivedSharedKey = hasRemoteParticipant && sharedKeyReady;
  const transportReady = hasRemoteParticipant && hasDerivedSharedKey;
  const composerEnabled = transportReady && !sessionEnded;

  function serializeChatContent(content: ChatContent) {
    return JSON.stringify(content);
  }

  function deserializeChatContent(serialized: string): ChatContent {
    try {
      const parsed = JSON.parse(serialized) as Partial<ChatContent>;
      if (parsed.kind === "image" && typeof parsed.imageUrl === "string") {
        return {
          kind: "image",
          imageUrl: parsed.imageUrl,
          fileName: typeof parsed.fileName === "string" ? parsed.fileName : undefined,
        };
      }

      if (parsed.kind === "text" && typeof parsed.text === "string") {
        return {
          kind: "text",
          text: parsed.text,
        };
      }
    } catch {
      // Backward compatibility with pre-JSON text messages.
    }

    return {
      kind: "text",
      text: serialized,
    };
  }

  function clearSessionUi(description: string) {
    setMessages(wipeMessages());
    setSessionEnded(true);
    setSessionDescription(description);
  }

  async function cleanupEphemeralIdentity() {
    if (!services || cleanupStartedRef.current) {
      return;
    }

    cleanupStartedRef.current = true;

    try {
      await releaseUsernameLease(services.database, myUsername, currentUserId);
    } catch {
      // Best-effort cleanup for username reuse.
    }

    try {
      await deleteProfileById(services.firestore, currentUserId);
    } catch {
      // Best-effort cleanup for username reuse.
    }

    try {
      await deleteCurrentAnonymousUser();
    } catch {
      // Best-effort cleanup for anonymous auth teardown.
    }
  }

  const handlePageExitCleanup = useEffectEvent(() => {
    void cleanupEphemeralIdentity();
  });

  useEffect(() => {
    if (!services) {
      return;
    }

    const releaseOnPageHide = () => {
      handlePageExitCleanup();
    };

    window.addEventListener("pagehide", releaseOnPageHide);
    window.addEventListener("beforeunload", releaseOnPageHide);

    return () => {
      window.removeEventListener("pagehide", releaseOnPageHide);
      window.removeEventListener("beforeunload", releaseOnPageHide);
    };
  }, [services]);

  const handleRealtimeEvent = useEffectEvent(async (event: RealtimeEvent) => {
    if (event.senderId === currentUserId) {
      return;
    }

    if (event.type === "message") {
      if (!sharedKeyRef.current || !counterpart) {
        return;
      }

      const decrypted = await decryptMessage(
        sharedKeyRef.current,
        event.ciphertext,
        event.iv,
      );
      const content = deserializeChatContent(decrypted);

      setLastPayload(event);
      setSessionEnded(false);
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: crypto.randomUUID(),
          senderId: event.senderId,
          senderLabel: counterpart.username,
          kind: content.kind,
          plaintext: content.kind === "text" ? content.text : "",
          imageUrl: content.kind === "image" ? content.imageUrl : undefined,
          fileName: content.kind === "image" ? content.fileName : undefined,
          createdAt: event.sentAt,
          direction: "incoming",
          status: content.kind === "text" ? "decrypting" : "ready",
          encryptedPreview:
            content.kind === "text" ? `${event.ciphertext.slice(0, 18)}...` : undefined,
        },
      ]);
      return;
    }

    if (event.type === "session-start") {
      setSessionEnded(false);
      setMessages((currentMessages) =>
        currentMessages.some((message) => message.plaintext === "New secure session started.")
          ? currentMessages
          : [...currentMessages, createSystemMessage("New secure session started.")],
      );
      return;
    }

    if (event.type === "session-burn") {
      clearSessionUi(
        "The other participant burned the session. Messages were wiped locally and never persisted to Firebase.",
      );
      await cleanupEphemeralIdentity();
      router.push("/");
      return;
    }

    clearSessionUi(
      event.reason === "leave"
        ? "The other participant left the room. A new join starts with an empty transcript."
        : "The other participant disconnected. The in-memory transcript was cleared.",
    );
    await cleanupEphemeralIdentity();
    router.push("/");
  });

  useEffect(() => {
    if (!services) {
      return;
    }

    let removePresence: (() => Promise<void> | void) | null = null;

    void (async () => {
      removePresence = await registerPresence(
        services.database,
        roomId,
        currentUserId,
        myUsername,
      );
    })();

    const unsubscribePresence = subscribeToPresence(
      services.database,
      roomId,
      (userIds) => {
        const remotePresent = userIds.some((userId) => userId !== currentUserId);
        setIsRemoteOnline(remotePresent);

        if (remotePresent) {
          participantSeenRef.current = true;
          setSessionEnded(false);
        } else if (participantSeenRef.current) {
          clearSessionUi(
            "The other participant disconnected. The transcript was wiped from memory immediately.",
          );
        }
      },
    );

    return () => {
      unsubscribePresence();
      void removePresence?.();
    };
  }, [counterpart, currentUserId, myUsername, roomId, services]);

  useEffect(() => {
    if (!services || !counterpart) {
      sharedKeyRef.current = null;
      return;
    }

    void Promise.resolve().then(async () => {
      try {
        setSharedKeyReady(false);
        const keyPair = await getOrCreateIdentityKeyPair();
        const counterpartPublicKey = await importPublicKey(counterpart.publicKey);
        sharedKeyRef.current = await deriveSharedKey(
          keyPair.privateKey,
          counterpartPublicKey,
        );
        setSharedKeyReady(true);
      } catch (caughtError) {
        sharedKeyRef.current = null;
        setSharedKeyReady(false);
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Could not initialize secure transport.",
        );
      }
    });
  }, [counterpart, roomId, services]);

  useEffect(() => {
    if (!services) {
      return;
    }

    return subscribeToRoomEvents(
      services.database,
      roomId,
      currentUserId,
      (event) => {
        void handleRealtimeEvent(event);
      },
    );
  }, [currentUserId, roomId, services]);

  async function sendMessage(plaintext: string) {
    return sendEncryptedContent({
      kind: "text",
      text: plaintext,
    });
  }

  async function sendImage(file: File) {
    const imageUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
          return;
        }

        reject(new Error("Could not read image file."));
      };
      reader.onerror = () => reject(reader.error ?? new Error("Could not read image file."));
      reader.readAsDataURL(file);
    });

    return sendEncryptedContent({
      kind: "image",
      imageUrl,
      fileName: file.name,
    });
  }

  async function sendEncryptedContent(content: ChatContent) {
    const sharedKey = sharedKeyRef.current;

    if (!sharedKey || !counterpart || !services) {
      throw new Error("Secure channel not ready.");
    }

    const { ciphertext, iv } = await encryptMessage(
      sharedKey,
      serializeChatContent(content),
    );
    const payload: RealtimeEncryptedPayload = {
      type: "message",
      roomId,
      senderId: currentUserId,
      senderUsername: myUsername,
      ciphertext,
      iv,
      sentAt: new Date().toISOString(),
    };

    await sendRoomEvent({
      database: services.database,
      roomId,
      event: payload,
    });
    setLastPayload(payload);
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: crypto.randomUUID(),
        senderId: currentUserId,
        senderLabel: myUsername,
        kind: content.kind,
        plaintext: content.kind === "text" ? content.text : "",
        imageUrl: content.kind === "image" ? content.imageUrl : undefined,
        fileName: content.kind === "image" ? content.fileName : undefined,
        createdAt: payload.sentAt,
        direction: "outgoing",
        status: "ready",
      },
    ]);
  }

  async function finishSession(reason: "leave" | "burn") {
    if (services) {
      await sendRoomEvent({
        database: services.database,
        roomId,
        event:
          reason === "burn"
            ? {
                type: "session-burn",
                roomId,
                senderId: currentUserId,
                sentAt: new Date().toISOString(),
              }
            : {
                type: "session-end",
                roomId,
                senderId: currentUserId,
                sentAt: new Date().toISOString(),
                reason: "leave",
              },
      });
    }

    if (services) {
      await markRoomInactive(services.firestore, roomId);
      await clearRoomEvents(services.database, roomId);
    }

    setMessages(wipeMessages());
    await cleanupEphemeralIdentity();
    router.push("/");
  }

  return (
    <div className="relative z-10 mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl flex-col gap-4 lg:gap-5">
      <SessionHeader
        roomId={roomId}
        username={myUsername}
        counterpartUsername={counterpart?.username ?? "Awaiting participant"}
        isRemoteOnline={isRemoteOnline}
        sessionEnded={sessionEnded}
        onLeave={() => void finishSession("leave")}
        onBurn={() => void finishSession("burn")}
      />

      <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <MessageList
            messages={messages}
            emptyState={
              <div className="hud-panel flex min-h-[36vh] flex-col items-center justify-center rounded-[24px] border border-dashed border-primary/15 bg-black/20 px-6 text-center">
                <div className="rounded-full border border-primary/20 bg-primary/10 p-3 text-primary shadow-[0_0_24px_rgba(0,255,170,0.14)]">
                  {composerEnabled ? (
                    <ShieldBadge />
                  ) : !counterpart ? (
                    <Link2 className="h-6 w-6" />
                  ) : (
                    <LoaderCircle className="h-6 w-6 animate-spin" />
                  )}
                </div>
                <h2 className="mt-4 font-mono text-xl font-semibold uppercase tracking-[0.14em] text-cyan-50">
                  {transportReady
                    ? "Secure tunnel live"
                    : isRemoteOnline
                    ? "Secure tunnel live"
                    : counterpart
                      ? "Waiting for encrypted delivery channel"
                      : "Invite link created"}
                </h2>
                {!counterpart ? (
                  <p className="mt-3 max-w-md font-mono text-sm leading-6 text-cyan-100/55">
                    Share this room URL with one other person.
                  </p>
                ) : null}
              </div>
            }
          />

          <ChatComposer
            disabled={!composerEnabled}
            onSend={sendMessage}
            onSendImage={sendImage}
          />
        </div>

        <aside className="space-y-4">
          {!counterpart ? (
            <Card className="hud-panel p-5">
              <div className="rounded-[24px] border border-primary/15 bg-primary/8 p-4">
                <p className="terminal-label">
                  Invite link
                </p>
                <code className="mt-3 block overflow-x-auto rounded-2xl bg-black/20 px-3 py-2 font-mono text-xs text-cyan-100">
                  {inviteLink}
                </code>
                <Button
                  className="mt-4 w-full font-mono uppercase tracking-[0.14em]"
                  variant="secondary"
                  onClick={() => void navigator.clipboard.writeText(inviteLink)}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy room link
                </Button>
              </div>
            </Card>
          ) : null}

          <Card className="hud-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-semibold uppercase tracking-[0.14em]">Encrypted payload debug</p>
                <p className="mt-1 font-mono text-xs leading-5 text-cyan-100/48">
                  inspect outbound transport frames
                </p>
              </div>
              <Switch
                checked={debugEnabled}
                onCheckedChange={setDebugEnabled}
                aria-label="Toggle debug payload view"
              />
            </div>

            {debugEnabled ? (
              <div className="mt-4 rounded-[24px] border border-white/10 bg-black/25 p-4 font-mono text-xs leading-6 text-cyan-100">
                <div className="mb-2 flex items-center gap-2 text-cyan-300">
                  <Bug className="h-4 w-4" />
                  Last transport payload
                </div>
                {lastPayload ? (
                  <pre className="overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(lastPayload, null, 2)}
                  </pre>
                ) : (
                  <p className="text-muted-foreground">No messages sent or received yet.</p>
                )}
              </div>
            ) : null}
          </Card>

          <Card className="hud-panel p-5">
            <p className="terminal-label">
              Session diagnostics
            </p>
            <div className="mt-4 space-y-2 font-mono text-sm leading-6 text-cyan-100/70">
              <div className="flex items-center justify-between gap-4">
                <span>Remote participant found</span>
                <Badge variant={hasRemoteParticipant ? "default" : "secondary"}>
                  {hasRemoteParticipant ? "yes" : "no"}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Remote participant online</span>
                <Badge variant={isRemoteOnline ? "default" : "secondary"}>
                  {isRemoteOnline ? "yes" : "no"}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Shared key derived</span>
                <Badge variant={hasDerivedSharedKey ? "default" : "secondary"}>
                  {hasDerivedSharedKey ? "yes" : "no"}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Composer enabled</span>
                <Badge variant={composerEnabled ? "default" : "secondary"}>
                  {composerEnabled ? "yes" : "no"}
                </Badge>
              </div>
              <p className="pt-2 font-mono text-xs leading-5 text-cyan-100/42">
                composer unlock follows counterpart profile and shared key readiness
              </p>
            </div>
          </Card>

          {error ? (
            <Card className="hud-panel border-destructive/20 p-5">
              <div className="flex items-start gap-3 text-destructive-foreground">
                <AlertTriangle className="mt-0.5 h-5 w-5" />
                <div>
                  <p className="font-mono font-semibold uppercase tracking-[0.14em]">Secure session error</p>
                  <p className="mt-1 font-mono text-sm text-muted-foreground">{error}</p>
                  <Button className="mt-4 font-mono uppercase tracking-[0.14em]" variant="secondary" onClick={() => router.push("/")}>
                    Return home
                  </Button>
                </div>
              </div>
            </Card>
          ) : null}
        </aside>
      </div>

      <SessionEndedDialog
        open={sessionEnded}
        description={sessionDescription}
        roomId={roomId}
        onClose={() => setSessionEnded(false)}
      />
    </div>
  );
}

function ShieldBadge() {
  return <div className="h-6 w-6 rounded-full bg-primary shadow-[0_0_24px_rgba(0,255,170,0.45)]" />;
}
