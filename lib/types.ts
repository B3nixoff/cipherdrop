export type ProfileRow = {
  id: string;
  username: string;
  public_key: string;
  created_at?: string;
};

export type RoomRow = {
  id: string;
  participant_a: string;
  participant_b: string | null;
  active: boolean;
  created_at?: string;
  expires_at?: string | null;
};

export type RealtimeEncryptedPayload = {
  type: "message";
  roomId: string;
  senderId: string;
  senderUsername: string;
  ciphertext: string;
  iv: string;
  sentAt: string;
};

export type RealtimeSessionEvent =
  | {
      type: "session-start";
      roomId: string;
      senderId: string;
      sentAt: string;
    }
  | {
      type: "session-end";
      roomId: string;
      senderId: string;
      sentAt: string;
      reason: "leave" | "disconnect";
    }
  | {
      type: "session-burn";
      roomId: string;
      senderId: string;
      sentAt: string;
    }
  | {
      type: "call-invite";
      roomId: string;
      senderId: string;
      sentAt: string;
    }
  | {
      type: "call-accept";
      roomId: string;
      senderId: string;
      sentAt: string;
    }
  | {
      type: "call-reject";
      roomId: string;
      senderId: string;
      sentAt: string;
    }
  | {
      type: "call-end";
      roomId: string;
      senderId: string;
      sentAt: string;
      reason: "hangup" | "leave" | "burn";
    }
  | {
      type: "webrtc-offer";
      roomId: string;
      senderId: string;
      sentAt: string;
      sdp: string;
    }
  | {
      type: "webrtc-answer";
      roomId: string;
      senderId: string;
      sentAt: string;
      sdp: string;
    }
  | {
      type: "webrtc-ice";
      roomId: string;
      senderId: string;
      sentAt: string;
      candidate: string;
      sdpMid: string | null;
      sdpMLineIndex: number | null;
    };

export type RealtimeEvent = RealtimeEncryptedPayload | RealtimeSessionEvent;

export type ChatContent =
  | {
      kind: "text";
      text: string;
    }
  | {
      kind: "image";
      imageUrl: string;
      fileName?: string;
    };

export type SessionMessage = {
  id: string;
  senderId: string;
  senderLabel: string;
  kind: "text" | "image";
  plaintext: string;
  imageUrl?: string;
  fileName?: string;
  createdAt: string;
  direction: "incoming" | "outgoing" | "system";
  status?: "decrypting" | "ready";
  encryptedPreview?: string;
};
