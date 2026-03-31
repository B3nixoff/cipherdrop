import {
  deleteUser,
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  type User,
} from "firebase/auth";
import type { FirebaseError } from "firebase/app";

import { getFirebaseApp } from "@/lib/firebase/client";

function normalizeFirebaseAuthError(error: unknown) {
  const firebaseError = error as FirebaseError | undefined;

  switch (firebaseError?.code) {
    case "auth/admin-restricted-operation":
    case "auth/operation-not-allowed":
      return "Anonymous Firebase Auth is not enabled yet.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized in Firebase Authentication.";
    case "auth/invalid-api-key":
      return "The Firebase API key is invalid.";
    case "auth/app-not-authorized":
      return "This Firebase app is not authorized for the current project.";
    default:
      return firebaseError?.message || "Firebase authentication failed.";
  }
}

export async function ensureAuthenticatedUser() {
  try {
    const auth = getAuth(getFirebaseApp());

    if (auth.currentUser) {
      return auth.currentUser;
    }

    const existingUser = await new Promise<User | null>((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve(user);
      });
    });

    if (existingUser) {
      return existingUser;
    }

    const credentials = await signInAnonymously(auth);
    return credentials.user;
  } catch (error) {
    throw new Error(normalizeFirebaseAuthError(error));
  }
}

export async function deleteCurrentAnonymousUser() {
  try {
    const auth = getAuth(getFirebaseApp());
    const user = auth.currentUser;

    if (!user) {
      return;
    }

    if (!user.isAnonymous) {
      return;
    }

    await deleteUser(user);
  } catch (error) {
    throw new Error(normalizeFirebaseAuthError(error));
  }
}
