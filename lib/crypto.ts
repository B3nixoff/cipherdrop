const DB_NAME = "cipherdrop-keys";
const STORE_NAME = "identity";
const KEY_ID = "ecdh-identity";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function generateIdentityKeyPair() {
  return crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveKey"],
  );
}

export async function exportPublicKey(publicKey: CryptoKey) {
  const raw = await crypto.subtle.exportKey("raw", publicKey);
  return encodeBase64(new Uint8Array(raw));
}

export async function importPublicKey(publicKeyBase64: string) {
  return crypto.subtle.importKey(
    "raw",
    decodeBase64(publicKeyBase64),
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    [],
  );
}

export async function deriveSharedKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
) {
  return crypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: publicKey,
    },
    privateKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptMessage(sharedKey: CryptoKey, plaintext: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    sharedKey,
    encoder.encode(plaintext),
  );

  return {
    ciphertext: encodeBase64(new Uint8Array(ciphertext)),
    iv: encodeBase64(iv),
  };
}

export async function decryptMessage(
  sharedKey: CryptoKey,
  ciphertextBase64: string,
  ivBase64: string,
) {
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: decodeBase64(ivBase64),
    },
    sharedKey,
    decodeBase64(ciphertextBase64),
  );

  return decoder.decode(plaintext);
}

export function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

export function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function openKeyDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readStoredKeyPair() {
  const db = await openKeyDatabase();

  return new Promise<CryptoKeyPair | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(KEY_ID);

    request.onsuccess = () => resolve((request.result as CryptoKeyPair) ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function persistKeyPair(keyPair: CryptoKeyPair) {
  const db = await openKeyDatabase();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(keyPair, KEY_ID);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getOrCreateIdentityKeyPair() {
  const existing = await readStoredKeyPair();
  if (existing) {
    return existing;
  }

  const generated = await generateIdentityKeyPair();
  await persistKeyPair(generated);
  return generated;
}
