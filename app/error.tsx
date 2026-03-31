"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="glass-panel w-full max-w-lg rounded-[28px] p-8 text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-primary">
          Secure channel interrupted
        </p>
        <h1 className="mt-4 text-3xl font-semibold">Something went wrong</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Reloading starts a fresh empty session. No chat history is stored on
          this service.
        </p>
        <Button className="mt-6" onClick={() => reset()}>
          Try again
        </Button>
      </div>
    </main>
  );
}
