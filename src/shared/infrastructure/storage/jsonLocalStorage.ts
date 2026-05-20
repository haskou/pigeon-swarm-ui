function isJsonObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readJsonObjectFromLocalStorage<T extends object>(
  key: string,
  fallback: T,
): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);

    if (!raw) return fallback;

    const parsed: unknown = JSON.parse(raw);

    return isJsonObject(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJsonToLocalStorage<T>(key: string, value: T): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Browsers may reject writes in private mode or when quota is exceeded.
  }
}

export function writeStringToLocalStorage(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Browsers may reject writes in private mode or when quota is exceeded.
  }
}
