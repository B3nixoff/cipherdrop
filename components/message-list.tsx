"use client";

import { useEffect, useRef } from "react";

import { MessageBubble } from "@/components/message-bubble";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SessionMessage } from "@/lib/types";

export function MessageList({
  messages,
  emptyState,
}: {
  messages: SessionMessage[];
  emptyState: React.ReactNode;
}) {
  const anchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    anchorRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages]);

  return (
    <ScrollArea className="glass-panel hud-panel h-[48vh] rounded-[28px] p-4 sm:h-[56vh]">
      <div className="space-y-3">
        {messages.length === 0 ? emptyState : null}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={anchorRef} />
      </div>
    </ScrollArea>
  );
}
