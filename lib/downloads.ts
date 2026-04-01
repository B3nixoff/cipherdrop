export const RELEASE_TAG = "v0.1.0";

const RELEASE_BASE = `https://github.com/B3nixoff/cipherdrop/releases/download/${RELEASE_TAG}`;

export const DOWNLOADS = {
  windowsExe: `${RELEASE_BASE}/CipherDrop.exe`,
  windowsZip: `${RELEASE_BASE}/CipherDrop-win-unpacked.zip`,
  ubuntuDeb: `${RELEASE_BASE}/CipherDrop-Linux-0.1.0-amd64.deb`,
  linuxRpm: `${RELEASE_BASE}/CipherDrop-Linux-0.1.0-x86_64.rpm`,
  ubuntuTarGz: `${RELEASE_BASE}/CipherDrop-Linux-0.1.0-x64.tar.gz`,
} as const;
