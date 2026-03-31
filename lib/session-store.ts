import type { SessionMessage } from "@/lib/types";

export function createSystemMessage(text: string): SessionMessage {
  return {
    id: crypto.randomUUID(),
    senderId: "system",
    senderLabel: "System",
    kind: "text",
    plaintext: text,
    createdAt: new Date().toISOString(),
    direction: "system",
    status: "ready",
  };
}

export function wipeMessages() {
  return [] as SessionMessage[];
}
