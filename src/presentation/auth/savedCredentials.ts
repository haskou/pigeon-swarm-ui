export type SavedCredentials = {
  identityId: string;
  password: string;
};

const SAVED_CREDENTIALS_KEY = 'pigeon-swarm-credentials';

export function clearSavedCredentials(): void {
  localStorage.removeItem(SAVED_CREDENTIALS_KEY);
}

export function loadSavedCredentials(): SavedCredentials | null {
  const savedCredentials = localStorage.getItem(SAVED_CREDENTIALS_KEY);

  if (!savedCredentials) return null;

  try {
    const parsed = JSON.parse(savedCredentials) as Partial<SavedCredentials>;

    if (!parsed.identityId || !parsed.password) {
      clearSavedCredentials();
      return null;
    }

    return {
      identityId: parsed.identityId,
      password: parsed.password,
    };
  } catch {
    clearSavedCredentials();
    return null;
  }
}

export function saveCredentials(credentials: SavedCredentials): void {
  localStorage.setItem(SAVED_CREDENTIALS_KEY, JSON.stringify(credentials));
}
