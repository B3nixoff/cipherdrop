"use client";

import Link from "next/link";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type SessionEndedDialogProps = {
  open: boolean;
  description: string;
  roomId: string;
  onClose: () => void;
};

export function SessionEndedDialog({
  open,
  description,
  roomId,
  onClose,
}: SessionEndedDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Secure session ended</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
          The room metadata may still exist, but message history was never stored.
          Rejoining room {roomId.slice(0, 8)} starts from an empty transcript.
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Stay here
          </Button>
          <Button asChild>
            <Link href="/">Return home</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
