# CipherDrop

## Credits

Developed by B3nix.
Developed by X - Gaming & Tech.

Project: CipherDrop

## Architecture

- Firebase Auth: anonymous sign-in bootstrap
- Firestore: profiles, rooms, and WebRTC signaling only
- Realtime Database: presence and disconnect cleanup
- WebRTC data channel: encrypted message transport
- Web Crypto: ECDH P-256 key exchange and AES-GCM message encryption

## Security model

- Messages are encrypted locally before transport.
- Private keys never leave the client and stay only in IndexedDB.
- Firestore stores public keys, room metadata, and signaling metadata only.
- Realtime Database stores presence state only.
- Encrypted chat messages are not written to Firestore or Realtime Database.
- The decrypt animation is visual only; cryptographic decryption happens immediately on receipt.

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_DATABASE_URL`

## Firebase setup

1. Create a Firebase project.
2. Enable Anonymous authentication in Firebase Auth.
3. Create a Firestore database.
4. Create a Realtime Database.
5. Apply the rules from [firebase/firestore.rules](/home/b3nix/Asztal/encryption/firebase/firestore.rules) and [firebase/database.rules.json](/home/b3nix/Asztal/encryption/firebase/database.rules.json).
6. Run locally with `pnpm dev`.

## Hosting

For this Next.js app, prefer Firebase App Hosting.

Firebase's official docs currently say that for full-stack Next.js apps they strongly recommend App Hosting over the older Hosting framework integration:
- https://firebase.google.com/docs/hosting/frameworks/nextjs
- https://firebase.google.com/docs/app-hosting/configure

### Console flow

1. Push this repo to GitHub.
2. In Firebase Console, open `Build` -> `App Hosting`.
3. Create a backend.
4. Connect the GitHub repository and branch.
5. Add the same `NEXT_PUBLIC_FIREBASE_*` variables in the backend environment settings.
6. Deploy the backend.

### Local helper commands

- `pnpm firebase:rules`
- `pnpm firebase:apphosting:init`
- `pnpm firebase:apphosting:backends`

`apphosting.yaml` is included in the repo with a minimal Cloud Run runtime config.

## Desktop app

This repo also includes an Electron desktop wrapper for the hosted CipherDrop app.

### Desktop scripts

- `pnpm desktop:app`
- `pnpm desktop:dev`
- `pnpm desktop:pack`
- `pnpm desktop:dist`
- `pnpm desktop:dist:linux`
- `pnpm desktop:dist:mac`

### Desktop outputs

- Linux AppImage: `dist-desktop/CipherDrop-Linux-0.1.0-x86_64.AppImage`
- Windows executable: `dist-desktop/win-unpacked/CipherDrop.exe`
- Windows ZIP: `dist-desktop/CipherDrop-win-unpacked.zip`

Building the full Windows installer on Linux requires `wine`, but the unpacked `.exe` build can still be produced.

## Android app

CipherDrop now includes a Capacitor Android wrapper that loads the hosted app.

### Android scripts

- `pnpm mobile:copy`
- `pnpm mobile:sync`
- `pnpm mobile:open:android`
- `pnpm mobile:run:android`

### Android workflow

1. Deploy the web app first with `pnpm dlx vercel --prod` and ensure `https://cipherdrop.eu` points to the live site.
2. Sync the hosted URL into the Android wrapper with `pnpm mobile:sync`.
3. Open the native project in Android Studio with `pnpm mobile:open:android`.
4. Build the APK or AAB from Android Studio.

### Android branding

The Android launcher icon and splash assets are generated from `assets/icons/icon.png`.
