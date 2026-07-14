const storageKey = 'pigeon-swarm-technical-details-v1';
const preferenceChangedEvent = 'pigeon:technical-details-changed';

export class TechnicalDetailsPreference {
  public static enabled(): boolean {
    try {
      return globalThis.localStorage?.getItem(storageKey) === 'true';
    } catch {
      return false;
    }
  }

  public static subscribe(listener: () => void): () => void {
    const onStorage = (event: StorageEvent): void => {
      if (event.key === storageKey) listener();
    };

    globalThis.addEventListener?.(preferenceChangedEvent, listener);
    globalThis.addEventListener?.('storage', onStorage as EventListener);

    return () => {
      globalThis.removeEventListener?.(preferenceChangedEvent, listener);
      globalThis.removeEventListener?.('storage', onStorage as EventListener);
    };
  }

  public static update(enabled: boolean): void {
    try {
      globalThis.localStorage?.setItem(storageKey, String(enabled));
    } catch {
      return;
    }

    globalThis.dispatchEvent?.(new Event(preferenceChangedEvent));
  }
}
