"use client";

import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

const SCRAMBLE_CHARS = "01ABCDEF$#%&*+<>?{}[]/\\";

type DecryptingMessageProps = {
  finalPlaintext: string;
  encryptedPreview?: string;
  className?: string;
};

export function DecryptingMessage({
  finalPlaintext,
  encryptedPreview,
  className,
}: DecryptingMessageProps) {
  const [revealed, setRevealed] = useState(false);
  const [displayText, setDisplayText] = useState(
    encryptedPreview ?? "Decrypting secure message...",
  );
  const [statusText, setStatusText] = useState("Verifying & decrypting...");

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    let revealTimeout = 0;
    let scrambleInterval = 0;

    if (prefersReducedMotion) {
      revealTimeout = window.setTimeout(() => setRevealed(true), 150);
      return () => window.clearTimeout(revealTimeout);
    }

    const duration = 800 + Math.floor(Math.random() * 1000);
    const start = performance.now();
    const statuses = [
      "Decrypting...",
      "Securely decoding...",
      "Verifying & decrypting...",
    ];

    scrambleInterval = window.setInterval(() => {
      const progress = Math.min((performance.now() - start) / duration, 1);
      const revealedChars = Math.floor(progress * finalPlaintext.length);
      const text = finalPlaintext
        .split("")
        .map((char, index) => {
          if (char === " ") {
            return " ";
          }

          if (index < revealedChars) {
            return finalPlaintext[index];
          }

          return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
        })
        .join("");

      setDisplayText(text);
      setStatusText(statuses[Math.min(statuses.length - 1, Math.floor(progress * statuses.length))]);

      if (progress >= 1) {
        window.clearInterval(scrambleInterval);
        setDisplayText(finalPlaintext);
        setRevealed(true);
      }
    }, 40);

    revealTimeout = window.setTimeout(() => {
      window.clearInterval(scrambleInterval);
      setDisplayText(finalPlaintext);
      setRevealed(true);
    }, duration + 50);

    return () => {
      window.clearInterval(scrambleInterval);
      window.clearTimeout(revealTimeout);
    };
  }, [encryptedPreview, finalPlaintext, prefersReducedMotion]);

  return (
    <div className={cn("space-y-2", className)}>
      {!revealed ? (
        <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-primary">
          {statusText}
        </div>
      ) : null}
      <p
        className={cn(
          "whitespace-pre-wrap break-words text-sm leading-6 transition duration-500",
          revealed ? "opacity-100 blur-0" : "opacity-90 blur-[1.8px]",
        )}
      >
        {displayText}
      </p>
    </div>
  );
}
