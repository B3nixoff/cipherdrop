"use client";

import { ImagePlus, SendHorizontal } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ChatComposerProps = {
  disabled?: boolean;
  onSend: (plaintext: string) => Promise<void>;
  onSendImage: (file: File) => Promise<void>;
};

const MAX_IMAGE_BYTES = 1024 * 1024 * 2;

export function ChatComposer({
  disabled,
  onSend,
  onSendImage,
}: ChatComposerProps) {
  const [value, setValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function submitMessage() {
    const trimmed = value.trim();
    if (!trimmed || disabled || isSending) {
      return;
    }

    setIsSending(true);
    setSendError(null);
    try {
      await onSend(trimmed);
      setValue("");
    } catch (error) {
      setSendError(
        error instanceof Error ? error.message : "Secure message delivery failed.",
      );
    } finally {
      setIsSending(false);
    }
  }

  async function handleFileSelection(file: File | null) {
    if (!file || disabled || isSending) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setSendError("Only image files can be sent.");
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setSendError("Image is too large. Keep it under 2 MB.");
      return;
    }

    setIsSending(true);
    setSendError(null);

    try {
      await onSendImage(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      setSendError(
        error instanceof Error ? error.message : "Secure image delivery failed.",
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="glass-panel hud-panel rounded-[28px] p-4">
      <label className="sr-only" htmlFor="message">
        Secure message
      </label>
      <Textarea
        id="message"
        value={value}
        disabled={disabled || isSending}
        className="min-h-[148px] border-primary/15 bg-black/35 font-mono text-cyan-50 placeholder:text-cyan-100/28"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void submitMessage();
          }
        }}
        placeholder={
          disabled
            ? "awaiting remote operator..."
            : "compose encrypted payload..."
        }
      />
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            void handleFileSelection(file);
          }}
        />
        <Button
          type="button"
          variant="secondary"
          className="min-w-36 self-start font-mono uppercase tracking-[0.16em]"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isSending}
        >
          <ImagePlus className="mr-2 h-4 w-4" />
          Send image
        </Button>
        <Button
          className="min-w-36 self-end font-mono uppercase tracking-[0.16em] sm:ml-auto"
          onClick={() => void submitMessage()}
          disabled={disabled || isSending || !value.trim()}
        >
          <SendHorizontal className="mr-2 h-4 w-4" />
          Send securely
        </Button>
      </div>
      {sendError ? (
        <p className="mt-3 font-mono text-sm text-destructive">{sendError}</p>
      ) : null}
    </div>
  );
}
