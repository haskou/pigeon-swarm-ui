export type AppLanguage = 'en';

const storageKey = 'pigeon-swarm-language';
const fallbackLanguage: AppLanguage = 'en';

export const languageOptions: Array<{ label: string; value: AppLanguage }> = [
  { label: '🇬🇧 English', value: 'en' },
];

export function getInitialLanguage(): AppLanguage {
  if (typeof window === 'undefined') return fallbackLanguage;

  const storedLanguage = window.localStorage.getItem(storageKey);

  if (isAppLanguage(storedLanguage)) return storedLanguage;

  const browserLanguage = window.navigator.language
    .split('-')[0]
    .toLowerCase();

  return isAppLanguage(browserLanguage) ? browserLanguage : fallbackLanguage;
}

export function saveLanguage(language: string): AppLanguage {
  const nextLanguage = isAppLanguage(language) ? language : fallbackLanguage;

  window.localStorage.setItem(storageKey, nextLanguage);

  return nextLanguage;
}

function isAppLanguage(language: string | null): language is AppLanguage {
  return languageOptions.some((option) => option.value === language);
}
