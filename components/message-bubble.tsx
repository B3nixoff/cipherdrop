"use client";
/* eslint-disable @next/next/no-img-element */

import { LockKeyhole, Sparkles } from "lucide-react";

import { DecryptingMessage } from "@/components/decrypting-message";
import { Badge } from "@/components/ui/badge";
import type { SessionMessage } from "@/lib/types";
import { cn, formatRelativeDate } from "@/lib/utils";

export function MessageBubble({ message }: { message: SessionMessage }) {
  if (message.direction === "system") {
    return (
      <div className="flex justify-center py-1">
        <div className="rounded-full border border-primary/15 bg-black/35 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-100/60">
          {message.plaintext}
        </div>
      </div>
    );
  }

  const isOutgoing = message.direction === "outgoing";

  return (
    <div className={cn("flex", isOutgoing ? "justify-end" : "justify-start")}>
      <article
        className={cn(
          "max-w-[85%] rounded-[20px] border px-4 py-3 sm:max-w-[70%]",
          isOutgoing
            ? "border-primary/25 bg-[linear-gradient(180deg,rgba(0,255,179,0.14),rgba(0,255,179,0.05))] text-foreground shadow-[0_0_18px_rgba(0,255,170,0.06)]"
            : "border-cyan-400/15 bg-[linear-gradient(180deg,rgba(10,20,28,0.95),rgba(5,10,14,0.98))] text-foreground",
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant={isOutgoing ? "default" : "secondary"} className="font-mono uppercase tracking-[0.12em]">
              {message.senderLabel}
            </Badge>
            {!isOutgoing ? <LockKeyhole className="h-3.5 w-3.5 text-primary" /> : null}
          </div>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {formatRelativeDate(message.createdAt)}
          </span>
        </div>

        {isOutgoing ? (
          message.kind === "image" && message.imageUrl ? (
            <figure className="space-y-3">
              <img
                src={message.imageUrl}
                alt={message.fileName ?? "Encrypted image"}
                className="max-h-[26rem] w-full rounded-2xl border border-primary/15 object-cover"
              />
              {message.fileName ? (
                <figcaption className="font-mono text-xs uppercase tracking-[0.14em] text-cyan-100/60">
                  {message.fileName}
                </figcaption>
              ) : null}
            </figure>
          ) : (
            <p className="whitespace-pre-wrap break-words font-mono text-sm leading-6">
              {message.plaintext}
            </p>
          )
        ) : (
          message.kind === "image" && message.imageUrl ? (
            <figure className="space-y-3">
              <img
                src={message.imageUrl}
                alt={message.fileName ?? "Encrypted image"}
                className="max-h-[26rem] w-full rounded-2xl border border-cyan-400/15 object-cover"
              />
              {message.fileName ? (
                <figcaption className="font-mono text-xs uppercase tracking-[0.14em] text-cyan-100/60">
                  {message.fileName}
                </figcaption>
              ) : null}
            </figure>
          ) : (
            <DecryptingMessage
              finalPlaintext={message.plaintext}
              encryptedPreview={message.encryptedPreview}
            />
          )
        )}

        {!isOutgoing ? (
          <div className="mt-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-primary/90">
            <Sparkles className="h-3.5 w-3.5" />
            Local decrypt reveal
          </div>
        ) : null}
      </article>
    </div>
  );
}
