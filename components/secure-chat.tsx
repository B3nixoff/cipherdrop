"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, Bug, Copy, Link2, LoaderCircle, Mic, MicOff, PhoneCall, PhoneIncoming, PhoneOff, Volume2 } from "lucide-react";
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

type CallState = "idle" | "outgoing" | "incoming" | "connecting" | "active";
const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

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
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

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
  const [callState, setCallState] = useState<CallState>("idle");
  const [callStatus, setCallStatus] = useState("No active voice call.");
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState("default");
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedOutputId, setSelectedOutputId] = useState("default");
  const [isMuted, setIsMuted] = useState(false);
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

  async function emitEvent(event: RealtimeEvent) {
    if (!services) {
      return;
    }

    await sendRoomEvent({
      database: services.database,
      roomId,
      event,
    });
  }

  function closeVoiceCall(shouldResetStatus = true) {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    setCallState("idle");
    if (shouldResetStatus) {
      setCallStatus("No active voice call.");
    }
  }

  async function getLocalAudioStream() {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio:
        selectedMicrophoneId && selectedMicrophoneId !== "default"
          ? {
              deviceId: {
                exact: selectedMicrophoneId,
              },
            }
          : true,
      video: false,
    });
    localStreamRef.current = stream;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !isMuted;
    });
    return stream;
  }

  async function refreshAudioDevices() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      return;
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(
      (device): device is MediaDeviceInfo => device.kind === "audioinput",
    );
    const outputs = devices.filter(
      (device): device is MediaDeviceInfo => device.kind === "audiooutput",
    );

    setMicrophones(audioInputs);
    setAudioOutputs(outputs);
    setSelectedMicrophoneId((current) => {
      if (current !== "default" && audioInputs.some((device) => device.deviceId === current)) {
        return current;
      }

      return audioInputs[0]?.deviceId ?? "default";
    });
    setSelectedOutputId((current) => {
      if (current === "default") {
        return "default";
      }

      if (outputs.some((device) => device.deviceId === current)) {
        return current;
      }

      return "default";
    });
  }

  async function replaceMicrophoneTrack(deviceId: string) {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    const stream = await getLocalAudioStream();
    const nextTrack = stream.getAudioTracks()[0];
    if (!nextTrack) {
      throw new Error("Selected microphone did not provide an audio track.");
    }

    const peerConnection = peerConnectionRef.current;
    const audioSender = peerConnection
      ?.getSenders()
      .find((sender) => sender.track?.kind === "audio");

    if (audioSender) {
      await audioSender.replaceTrack(nextTrack);
    } else if (peerConnection) {
      peerConnection.addTrack(nextTrack, stream);
    }

    localStreamRef.current = stream;
  }

  function getOrCreatePeerConnection() {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    const peerConnection = new RTCPeerConnection(rtcConfig);

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      void emitEvent({
        type: "webrtc-ice",
        roomId,
        senderId: currentUserId,
        sentAt: new Date().toISOString(),
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex,
      });
    };

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream || !remoteAudioRef.current) {
        return;
      }

      remoteAudioRef.current.srcObject = stream;
      void remoteAudioRef.current.play().catch(() => undefined);
      setCallState("active");
      setCallStatus("Voice call connected.");
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      if (state === "connected") {
        setCallState("active");
        setCallStatus("Voice call connected.");
        return;
      }

      if (state === "connecting") {
        setCallState("connecting");
        setCallStatus("Negotiating secure audio link...");
        return;
      }

      if (state === "failed" || state === "disconnected" || state === "closed") {
        closeVoiceCall();
      }
    };

    peerConnectionRef.current = peerConnection;
    return peerConnection;
  }

  async function attachLocalAudio(peerConnection: RTCPeerConnection) {
    const stream = await getLocalAudioStream();
    const senders = peerConnection.getSenders();

    for (const track of stream.getAudioTracks()) {
      const alreadyAttached = senders.some((sender) => sender.track?.id === track.id);
      if (!alreadyAttached) {
        peerConnection.addTrack(track, stream);
      }
    }
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
    closeVoiceCall(false);
    void cleanupEphemeralIdentity();
  });

  const refreshMicrophoneTrack = useEffectEvent(async () => {
    await replaceMicrophoneTrack(selectedMicrophoneId);
  });

  useEffect(() => {
    if (!isClient || typeof navigator === "undefined" || !navigator.mediaDevices) {
      return;
    }

    let active = true;

    async function loadMicrophones() {
      try {
        if (!active) {
          return;
        }

        await refreshAudioDevices();
      } catch {
        // Ignore device enumeration failures until the user starts a call.
      }
    }

    void loadMicrophones();
    navigator.mediaDevices.addEventListener?.("devicechange", loadMicrophones);

    return () => {
      active = false;
      navigator.mediaDevices.removeEventListener?.("devicechange", loadMicrophones);
    };
  }, [isClient]);

  useEffect(() => {
    if (!localStreamRef.current) {
      return;
    }

    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !isMuted;
    });
  }, [isMuted]);

  useEffect(() => {
    if (!localStreamRef.current) {
      return;
    }

    void refreshMicrophoneTrack().catch((caughtError) => {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not switch microphone.",
      );
    });
  }, [selectedMicrophoneId]);

  useEffect(() => {
    const audioEl = remoteAudioRef.current as (HTMLAudioElement & {
      setSinkId?: (sinkId: string) => Promise<void>;
    }) | null;

    if (!audioEl?.setSinkId) {
      return;
    }

    void audioEl.setSinkId(selectedOutputId).catch(() => {
      // Ignore unsupported sink changes for browsers without permissions.
    });
  }, [selectedOutputId]);

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

    if (event.type === "call-invite") {
      if (callState === "active" || callState === "connecting") {
        return;
      }

      setCallState("incoming");
      setCallStatus("Incoming encrypted voice call.");
      return;
    }

    if (event.type === "call-accept") {
      if (!services || callState !== "outgoing") {
        return;
      }

      const peerConnection = getOrCreatePeerConnection();
      await attachLocalAudio(peerConnection);
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
      });
      await peerConnection.setLocalDescription(offer);
      setCallState("connecting");
      setCallStatus("Negotiating secure audio link...");
      await emitEvent({
        type: "webrtc-offer",
        roomId,
        senderId: currentUserId,
        sentAt: new Date().toISOString(),
        sdp: offer.sdp ?? "",
      });
      return;
    }

    if (event.type === "call-reject") {
      closeVoiceCall();
      setCallStatus("The other participant rejected the voice call.");
      return;
    }

    if (event.type === "call-end") {
      closeVoiceCall();
      setCallStatus("The voice call ended.");
      return;
    }

    if (event.type === "webrtc-offer") {
      const peerConnection = getOrCreatePeerConnection();
      await attachLocalAudio(peerConnection);
      await peerConnection.setRemoteDescription({
        type: "offer",
        sdp: event.sdp,
      });
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      setCallState("connecting");
      setCallStatus("Negotiating secure audio link...");
      await emitEvent({
        type: "webrtc-answer",
        roomId,
        senderId: currentUserId,
        sentAt: new Date().toISOString(),
        sdp: answer.sdp ?? "",
      });
      return;
    }

    if (event.type === "webrtc-answer") {
      const peerConnection = peerConnectionRef.current;
      if (!peerConnection) {
        return;
      }

      await peerConnection.setRemoteDescription({
        type: "answer",
        sdp: event.sdp,
      });
      setCallState("connecting");
      setCallStatus("Negotiating secure audio link...");
      return;
    }

    if (event.type === "webrtc-ice") {
      const peerConnection = peerConnectionRef.current;
      if (!peerConnection) {
        return;
      }

      await peerConnection.addIceCandidate({
        candidate: event.candidate,
        sdpMid: event.sdpMid,
        sdpMLineIndex: event.sdpMLineIndex,
      });
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
      closeVoiceCall(false);
      clearSessionUi(
        "The other participant burned the session. Messages were wiped locally and never persisted to Firebase.",
      );
      await cleanupEphemeralIdentity();
      router.push("/");
      return;
    }

    closeVoiceCall(false);
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

  useEffect(() => {
    return () => {
      closeVoiceCall(false);
    };
  }, []);

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
    closeVoiceCall(false);

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

      await sendRoomEvent({
        database: services.database,
        roomId,
        event: {
          type: "call-end",
          roomId,
          senderId: currentUserId,
          sentAt: new Date().toISOString(),
          reason: reason === "burn" ? "burn" : "leave",
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

  async function startVoiceCall() {
    if (!counterpart || !services) {
      return;
    }

    try {
      setError(null);
      setCallState("outgoing");
      setCallStatus("Ringing remote participant...");
      await emitEvent({
        type: "call-invite",
        roomId,
        senderId: currentUserId,
        sentAt: new Date().toISOString(),
      });
    } catch (caughtError) {
      closeVoiceCall();
      setError(
        caughtError instanceof Error ? caughtError.message : "Could not start voice call.",
      );
    }
  }

  async function acceptVoiceCall() {
    if (!services) {
      return;
    }

    try {
      setError(null);
      await getLocalAudioStream();
      await refreshAudioDevices();
      setCallState("connecting");
      setCallStatus("Negotiating secure audio link...");
      await emitEvent({
        type: "call-accept",
        roomId,
        senderId: currentUserId,
        sentAt: new Date().toISOString(),
      });
    } catch (caughtError) {
      closeVoiceCall();
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not access microphone.",
      );
    }
  }

  async function rejectVoiceCall() {
    closeVoiceCall();
    await emitEvent({
      type: "call-reject",
      roomId,
      senderId: currentUserId,
      sentAt: new Date().toISOString(),
    });
  }

  async function endVoiceCall() {
    closeVoiceCall();
    await emitEvent({
      type: "call-end",
      roomId,
      senderId: currentUserId,
      sentAt: new Date().toISOString(),
      reason: "hangup",
    });
  }

  async function handleMicrophoneChange(deviceId: string) {
    setSelectedMicrophoneId(deviceId);

    if (!localStreamRef.current && callState === "idle") {
      return;
    }

    try {
      await replaceMicrophoneTrack(deviceId);
      await refreshAudioDevices();
      if (callState === "active") {
        setCallStatus("Microphone switched.");
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not switch microphone.",
      );
    }
  }

  return (
    <div className="relative z-10 mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl flex-col gap-4 lg:gap-5">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      <SessionHeader
        roomId={roomId}
        username={myUsername}
        counterpartUsername={counterpart?.username ?? "Awaiting participant"}
        isRemoteOnline={isRemoteOnline}
        sessionEnded={sessionEnded}
        callState={callState}
        onLeave={() => void finishSession("leave")}
        onBurn={() => void finishSession("burn")}
        onStartCall={() => void startVoiceCall()}
        onAcceptCall={() => void acceptVoiceCall()}
        onRejectCall={() => void rejectVoiceCall()}
        onEndCall={() => void endVoiceCall()}
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
            <p className="terminal-label">
              Voice link
            </p>
            <div className="mt-4 space-y-3 font-mono text-sm leading-6 text-cyan-100/70">
              <div className="flex items-center justify-between gap-4">
                <span>Current state</span>
                <Badge
                  variant={
                    callState === "active"
                      ? "success"
                      : callState === "incoming"
                        ? "warning"
                        : "secondary"
                  }
                >
                  {callState}
                </Badge>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-black/20 px-3 py-2 text-xs text-cyan-100/55">
                {callStatus}
              </div>
              <div className="space-y-2">
                <label className="terminal-label block" htmlFor="microphone-select">
                  microphone
                </label>
                <select
                  id="microphone-select"
                  value={selectedMicrophoneId}
                  onChange={(event) => void handleMicrophoneChange(event.target.value)}
                  className="h-11 w-full rounded-2xl border border-primary/20 bg-black/35 px-3 font-mono text-sm text-cyan-50 outline-none transition focus:border-primary/40"
                >
                  {microphones.length ? (
                    microphones.map((device, index) => (
                      <option key={device.deviceId || `${device.label}-${index}`} value={device.deviceId}>
                        {device.label || `Microphone ${index + 1}`}
                      </option>
                    ))
                  ) : (
                    <option value="default">Default microphone</option>
                  )}
                </select>
              </div>
              <div className="space-y-2">
                <label className="terminal-label block" htmlFor="output-select">
                  output
                </label>
                <select
                  id="output-select"
                  value={selectedOutputId}
                  onChange={(event) => setSelectedOutputId(event.target.value)}
                  className="h-11 w-full rounded-2xl border border-primary/20 bg-black/35 px-3 font-mono text-sm text-cyan-50 outline-none transition focus:border-primary/40"
                >
                  <option value="default">Default output</option>
                  {audioOutputs.map((device, index) => (
                    <option key={device.deviceId || `${device.label}-${index}`} value={device.deviceId}>
                      {device.label || `Output ${index + 1}`}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                variant={isMuted ? "destructive" : "secondary"}
                className="w-full font-mono uppercase tracking-[0.14em]"
                onClick={() => setIsMuted((current) => !current)}
              >
                {isMuted ? (
                  <MicOff className="mr-2 h-4 w-4" />
                ) : (
                  <Mic className="mr-2 h-4 w-4" />
                )}
                {isMuted ? "Unmute microphone" : "Mute microphone"}
              </Button>
              <div className="flex items-center gap-2 text-xs text-cyan-100/45">
                <Volume2 className="h-4 w-4" />
                output switching depends on browser support for audio sink selection
              </div>
            </div>
          </Card>

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
