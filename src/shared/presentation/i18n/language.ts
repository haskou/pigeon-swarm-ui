export type AppLanguage = 'en' | 'es';

const storageKey = 'pigeon-swarm-language-v2';
const explicitStorageKey = 'pigeon-swarm-language-explicit-v3';
const staleStorageKeys = [
  'pigeon-swarm-language',
  'pigeon-swarm-language-explicit-v1',
  'pigeon-swarm-language-explicit-v2',
];
const fallbackLanguage: AppLanguage = 'es';

export const languageOptions: Array<{ label: string; value: AppLanguage }> = [
  { label: '🇬🇧 English', value: 'en' },
  { label: '🇪🇸 Español', value: 'es' },
];

export function getInitialLanguage(): AppLanguage {
  if (typeof window === 'undefined') return fallbackLanguage;

  const storedLanguage = window.localStorage.getItem(storageKey);
  const explicitLanguage = window.localStorage.getItem(explicitStorageKey);

  if (explicitLanguage === 'true' && isAppLanguage(storedLanguage)) {
    return storedLanguage;
  }

  clearStaleLanguagePreferences();

  return fallbackLanguage;
}

export function saveLanguage(language: string): AppLanguage {
  const nextLanguage = isAppLanguage(language) ? language : fallbackLanguage;

  window.localStorage.setItem(storageKey, nextLanguage);
  window.localStorage.setItem(explicitStorageKey, 'true');

  return nextLanguage;
}

function isAppLanguage(language: string | null): language is AppLanguage {
  return languageOptions.some((option) => option.value === language);
}

function clearStaleLanguagePreferences() {
  for (const key of [storageKey, ...staleStorageKeys]) {
    window.localStorage.removeItem(key);
  }
}
