export type SavedCredentials = {
  identityId: string;
};

const SAVED_CREDENTIALS_KEY = 'pigeon-swarm-credentials';

export function clearSavedCredentials(): void {
  localStorage.removeItem(SAVED_CREDENTIALS_KEY);
}

export function saveCredentials(credentials: SavedCredentials): void {
  localStorage.setItem(SAVED_CREDENTIALS_KEY, JSON.stringify(credentials));
}

export function loadSavedCredentials(): SavedCredentials | null {
  const savedCredentials = localStorage.getItem(SAVED_CREDENTIALS_KEY);

  if (!savedCredentials) return null;

  try {
    const parsed = JSON.parse(savedCredentials) as Partial<SavedCredentials>;

    if (!parsed.identityId) {
      clearSavedCredentials();

      return null;
    }

    if ('password' in parsed) {
      saveCredentials({ identityId: parsed.identityId });
    }

    return {
      identityId: parsed.identityId,
    };
  } catch {
    clearSavedCredentials();

    return null;
  }
}
