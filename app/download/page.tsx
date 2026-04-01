import Image from "next/image";
import Link from "next/link";
import { Download, ExternalLink, MonitorSmartphone, Package, TerminalSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DOWNLOADS, RELEASE_TAG } from "@/lib/downloads";

function DownloadButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Button asChild className="font-mono uppercase tracking-[0.14em]">
      <a href={href} target="_blank" rel="noreferrer">
        <Download className="mr-2 h-4 w-4" />
        {label}
      </a>
    </Button>
  );
}

export default function DownloadPage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0 grid-noise opacity-35" />
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center">
        <Card className="hud-panel grid-noise w-full overflow-hidden">
          <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
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
                Download Center
              </CardTitle>
              <CardDescription className="mt-3 max-w-2xl font-mono text-sm text-cyan-100/70">
                Direct desktop downloads for Windows 10/11 and Linux.
              </CardDescription>
            </div>
            <div className="flex gap-3">
              <Button asChild variant="secondary" className="font-mono uppercase tracking-[0.14em]">
                <Link href="/">Home</Link>
              </Button>
              <Button asChild variant="outline" className="font-mono uppercase tracking-[0.14em]">
                <a
                  href={`https://github.com/B3nixoff/cipherdrop/releases/tag/${RELEASE_TAG}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Release
                </a>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <Card className="hud-panel border-primary/20 bg-black/25">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <MonitorSmartphone className="h-6 w-6 text-primary" />
                  <CardTitle className="font-mono text-2xl uppercase tracking-[0.16em]">
                    Windows 10 / 11
                  </CardTitle>
                </div>
                <CardDescription className="font-mono text-cyan-100/70">
                  Direct executable for quick launch, plus a ZIP fallback with the full unpacked app.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <DownloadButton href={DOWNLOADS.windowsExe} label="Download for Windows (.exe)" />
                <DownloadButton href={DOWNLOADS.windowsZip} label="Download ZIP" />
                <p className="font-mono text-xs leading-6 text-cyan-100/55">
                  If SmartScreen warns on first run, choose more info and confirm only if the
                  file was downloaded from the official CipherDrop release page.
                </p>
              </CardContent>
            </Card>

            <Card className="hud-panel border-primary/20 bg-black/25">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Package className="h-6 w-6 text-primary" />
                  <CardTitle className="font-mono text-2xl uppercase tracking-[0.16em]">
                    Linux
                  </CardTitle>
                </div>
                <CardDescription className="font-mono text-cyan-100/70">
                  Native Linux package downloads for Debian-based and RPM-based distros, plus a
                  portable tarball if you prefer manual unpacking.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <DownloadButton href={DOWNLOADS.ubuntuDeb} label="Download for Linux (.deb)" />
                <DownloadButton href={DOWNLOADS.linuxRpm} label="Download for Linux (.rpm)" />
                <DownloadButton href={DOWNLOADS.ubuntuTarGz} label="Download for Linux (.tar.gz)" />
                <div className="rounded-2xl border border-primary/15 bg-black/35 p-4">
                  <p className="terminal-label mb-2">Quick install</p>
                  <code className="block overflow-x-auto font-mono text-xs text-cyan-100">
                    sudo apt install ./CipherDrop-Linux-0.1.0-amd64.deb
                  </code>
                </div>
              </CardContent>
            </Card>

            <Card className="hud-panel border-primary/20 bg-black/25 lg:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <TerminalSquare className="h-6 w-6 text-primary" />
                  <CardTitle className="font-mono text-2xl uppercase tracking-[0.16em]">
                    Notes
                  </CardTitle>
                </div>
                <CardDescription className="font-mono text-cyan-100/70">
                  Release tag: {RELEASE_TAG}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 font-mono text-sm text-cyan-100/70">
                <p>Windows users should prefer the EXE unless they specifically want the unpacked ZIP.</p>
                <p>Ubuntu users can install with the DEB or extract the TAR.GZ and run the bundled app manually.</p>
                <p>The invite-link paste flow works in the web app and the desktop wrappers the same way.</p>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
