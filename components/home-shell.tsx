"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { Copy, Link2, UserRoundPlus } from "lucide-react";
import { startTransition, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ensureAuthenticatedUser } from "@/lib/firebase/auth";
import { getFirebaseServices } from "@/lib/firebase/client";
import {
  createInviteRoom,
  ensureExistingProfile,
  ensureProfile,
  getMyProfile,
} from "@/lib/firebase/queries";
import { claimUsernameLease, releaseUsernameLease, usernameExists } from "@/lib/realtime";
import { useIsClient } from "@/lib/hooks/use-is-client";

export function HomeShell() {
  const router = useRouter();
  const isClient = useIsClient();
  const services = useMemo(
    () => (isClient ? getFirebaseServices() : null),
    [isClient],
  );
  const [username, setUsername] = useState("");
  const [currentUsername, setCurrentUsername] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [status, setStatus] = useState("Preparing anonymous secure identity...");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!services) {
      return;
    }

    let active = true;

    startTransition(() => {
      void (async () => {
        try {
          const user = await ensureAuthenticatedUser();
          const profile = await getMyProfile(services.firestore, user.uid);

          if (!active) {
            return;
          }

          if (profile?.username) {
            await claimUsernameLease(services.database, profile.username, user.uid);
            setUsername(profile.username);
            setCurrentUsername(profile.username);
            setStatus("Identity ready. Create a secure invite session.");
          } else {
            setStatus("Choose a username to publish your public key.");
          }
        } catch (caughtError) {
          if (active) {
            setError(
              caughtError instanceof Error
                ? caughtError.message
                : "Could not initialize Firebase authentication.",
            );
          }
        }
      })();
    });

    return () => {
      active = false;
    };
  }, [services]);

  async function handleSaveIdentity() {
    setIsBusy(true);
    setError(null);

    try {
      if (!services) {
        throw new Error("Firebase client is still initializing.");
      }

      const normalized = username.trim().toLowerCase();
      if (normalized.length < 3) {
        throw new Error("Username must be at least 3 characters.");
      }

      const user = await ensureAuthenticatedUser();
      const existingOwner = await getMyProfile(services.firestore, user.uid);
      const existingUsername = existingOwner?.username ?? null;
      const takenByOtherUser =
        (await usernameExists(services.database, normalized)) &&
        existingUsername !== normalized;

      if (takenByOtherUser) {
        throw new Error("This username is already taken.");
      }

      await claimUsernameLease(services.database, normalized, user.uid);
      const profile = await ensureProfile(services.firestore, user, normalized);
      if (existingUsername && existingUsername !== profile.username) {
        await releaseUsernameLease(services.database, existingUsername, user.uid);
      }
      setCurrentUsername(profile.username);
      setUsername(profile.username);
      setStatus("Identity published. Your private key stays on this device.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not save your identity.",
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCreateSession() {
    setIsBusy(true);
    setError(null);

    try {
      if (!services) {
        throw new Error("Firebase client is still initializing.");
      }

      const me = await ensureAuthenticatedUser();
      await ensureExistingProfile(
        services.firestore,
        services.database,
        me,
        username || undefined,
      );
      const room = await createInviteRoom(services.firestore, me.uid);
      const nextInviteLink = `${window.location.origin}/chat/${room.id}`;
      setInviteLink(nextInviteLink);
      await navigator.clipboard.writeText(nextInviteLink);
      setStatus("Secure session created. Invite link copied to clipboard.");
      router.push(`/chat/${room.id}`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to create the secure room.",
      );
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0 grid-noise opacity-35" />
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center">
        <Card className="hud-panel grid-noise w-full overflow-hidden">
          <CardHeader>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-primary shadow-[0_0_24px_rgba(0,255,179,0.12)]">
              <Image
                src="/logo.png"
                alt="CipherDrop"
                width={18}
                height={18}
                className="rounded-sm"
              />
              CipherDrop
            </div>
            <CardTitle className="mt-3 font-mono text-3xl uppercase tracking-[0.18em] text-cyan-50 sm:text-4xl">
              Initialize Secure Session
            </CardTitle>
            <CardDescription className="font-mono text-sm text-cyan-100/70">
              {status}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="hud-panel space-y-3 p-4 sm:p-5">
              <label className="terminal-label block" htmlFor="username">
                Public Handle
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  id="username"
                  autoComplete="off"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="border-primary/20 bg-black/35 font-mono text-cyan-50 placeholder:text-cyan-100/30"
                  placeholder="alice"
                />
                <Button
                  className="font-mono uppercase tracking-[0.14em]"
                  onClick={handleSaveIdentity}
                  disabled={isBusy || !services}
                >
                  <UserRoundPlus className="mr-2 h-4 w-4" />
                  Save identity
                </Button>
              </div>
            </div>

            <Separator />

            <div className="hud-panel space-y-3 p-4 sm:p-5">
              <label className="terminal-label block">
                Create Invite Session
              </label>
              <Button
                className="w-full font-mono uppercase tracking-[0.14em]"
                size="lg"
                onClick={handleCreateSession}
                disabled={isBusy || !currentUsername || !services}
              >
                <Link2 className="mr-2 h-4 w-4" />
                Create secure invite link
              </Button>
              <p className="font-mono text-xs leading-6 text-cyan-100/55">
                Spawn a fresh room, then pass the direct link to exactly one second operator.
              </p>
            </div>

            {inviteLink ? (
              <div className="hud-panel p-4 text-sm text-primary-foreground">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <code className="block overflow-x-auto rounded-2xl border border-primary/15 bg-black/35 px-3 py-2 font-mono text-xs text-cyan-100">
                    {inviteLink}
                  </code>
                  <Button
                    variant="secondary"
                    className="font-mono uppercase tracking-[0.14em]"
                    onClick={() => void navigator.clipboard.writeText(inviteLink)}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                </div>
              </div>
            ) : null}

            {currentUsername ? (
              <div className="hud-panel border-emerald-400/20 p-4 font-mono text-sm text-emerald-100">
                Active handle: <span className="font-semibold text-emerald-300">{currentUsername}</span>
              </div>
            ) : null}

            {error ? (
              <div className="hud-panel border-destructive/30 bg-destructive/10 p-4 font-mono text-sm text-destructive-foreground">
                {error}
              </div>
            ) : null}

            <p className="terminal-label text-cyan-100/55">
              volatile transcript // no readable archive
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
