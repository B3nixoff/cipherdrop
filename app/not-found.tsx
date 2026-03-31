import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="glass-panel grid-noise w-full max-w-lg rounded-[28px] p-8 text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-primary">
          Session unavailable
        </p>
        <h1 className="mt-4 text-3xl font-semibold">Secure room not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The room may have expired, the participants changed, or you may no
          longer be authenticated on this device.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">Return home</Link>
        </Button>
      </div>
    </main>
  );
}
