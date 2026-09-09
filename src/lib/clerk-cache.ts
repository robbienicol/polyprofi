import * as SecureStore from 'expo-secure-store';

/**
 * Where Clerk persists the session so users stay signed in across app launches.
 *
 * `AFTER_FIRST_UNLOCK` matters: with the default (`WHEN_UNLOCKED`) the keychain
 * read fails whenever the app wakes on a locked phone — a background fetch or a
 * push tap — Clerk can't refresh the token, and the user lands on the sign-in
 * screen for no visible reason. Reads/writes also swallow errors instead of
 * throwing, so a keychain hiccup can't take the session (or the app) down.
 */
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export const clerkTokenCache = {
  getToken: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key, options);
    } catch {
      return null;
    }
  },
  saveToken: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value, options);
    } catch {
      // Non-fatal: the session just won't survive a relaunch.
    }
  },
  clearToken: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key, options);
    } catch {
      // Non-fatal.
    }
  },
};
