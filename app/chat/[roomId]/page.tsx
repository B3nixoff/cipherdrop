import { notFound } from "next/navigation";

import { SecureChatShell } from "@/components/secure-chat-shell";

type ChatRoomPageProps = {
  params: Promise<{ roomId: string }>;
};

export default async function ChatRoomPage({ params }: ChatRoomPageProps) {
  const { roomId } = await params;
  if (!roomId) {
    notFound();
  }

  return <SecureChatShell roomId={roomId} />;
}
