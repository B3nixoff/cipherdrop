"use client";

import { Flame, LogOut, Phone, PhoneCall, PhoneOff, ShieldCheck, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type SessionHeaderProps = {
  roomId: string;
  username: string;
  counterpartUsername: string;
  isRemoteOnline: boolean;
  sessionEnded: boolean;
  callState: "idle" | "outgoing" | "incoming" | "connecting" | "active";
  onLeave: () => void;
  onBurn: () => void;
  onStartCall: () => void;
  onAcceptCall: () => void;
  onRejectCall: () => void;
  onEndCall: () => void;
};

export function SessionHeader({
  roomId,
  username,
  counterpartUsername,
  isRemoteOnline,
  sessionEnded,
  callState,
  onLeave,
  onBurn,
  onStartCall,
  onAcceptCall,
  onRejectCall,
  onEndCall,
}: SessionHeaderProps) {
  const callBadgeLabel =
    callState === "active"
      ? "voice live"
      : callState === "incoming"
        ? "incoming call"
        : callState === "outgoing"
          ? "calling"
          : callState === "connecting"
            ? "voice linking"
            : "voice idle";

  return (
    <header className="glass-panel hud-panel relative z-10 rounded-[28px] p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default" className="font-mono uppercase tracking-[0.14em]">
              <ShieldCheck className="mr-2 h-3.5 w-3.5" />
              E2EE active
            </Badge>
            <Badge
              variant={isRemoteOnline ? "success" : "warning"}
              className="font-mono uppercase tracking-[0.14em]"
            >
              <span className="mr-2 h-2 w-2 rounded-full bg-current" />
              {isRemoteOnline ? "remote linked" : "awaiting peer"}
            </Badge>
            <Badge variant="secondary" className="font-mono uppercase tracking-[0.14em]">
              node {roomId.slice(0, 8)}
            </Badge>
            <Badge
              variant={callState === "active" ? "success" : callState === "incoming" ? "warning" : "secondary"}
              className="font-mono uppercase tracking-[0.14em]"
            >
              <PhoneCall className="mr-2 h-3.5 w-3.5" />
              {callBadgeLabel}
            </Badge>
          </div>
          <div>
            <p className="terminal-label mb-2">secure target</p>
            <h1 className="neon-text font-mono text-2xl font-semibold tracking-[0.08em] sm:text-3xl">
              {counterpartUsername}
            </h1>
            <p className="mt-1 flex items-center gap-2 font-mono text-sm text-cyan-100/60">
              <UserRound className="h-4 w-4" />
              local identity // {username}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {callState === "incoming" ? (
            <>
              <Button className="font-mono uppercase tracking-[0.14em]" onClick={onAcceptCall}>
                <Phone className="mr-2 h-4 w-4" />
                Accept
              </Button>
              <Button variant="outline" className="font-mono uppercase tracking-[0.14em]" onClick={onRejectCall}>
                <PhoneOff className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </>
          ) : callState === "active" || callState === "connecting" || callState === "outgoing" ? (
            <Button variant="outline" className="font-mono uppercase tracking-[0.14em]" onClick={onEndCall}>
              <PhoneOff className="mr-2 h-4 w-4" />
              End call
            </Button>
          ) : (
            <Button
              variant="outline"
              className="font-mono uppercase tracking-[0.14em]"
              onClick={onStartCall}
              disabled={sessionEnded}
            >
              <Phone className="mr-2 h-4 w-4" />
              Call
            </Button>
          )}
          <Button variant="secondary" className="font-mono uppercase tracking-[0.14em]" onClick={onLeave}>
            <LogOut className="mr-2 h-4 w-4" />
            Leave
          </Button>
          <Button variant="destructive" className="font-mono uppercase tracking-[0.14em]" onClick={onBurn}>
            <Flame className="mr-2 h-4 w-4" />
            Burn
          </Button>
        </div>
      </div>

      {sessionEnded ? (
        <div className="mt-4 rounded-3xl border border-amber-400/20 bg-amber-400/8 px-4 py-3 font-mono text-sm text-amber-100">
          session terminated // volatile transcript wiped
        </div>
      ) : null}
    </header>
  );
}
