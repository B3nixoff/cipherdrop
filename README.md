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
  
Building the full Windows installer on Linux requires `wine`, but the unpacked `.exe` build can still be produced.
