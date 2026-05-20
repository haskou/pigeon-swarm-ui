const storagePrefix = 'pigeon-swarm:archived-notifications';

function storageKey(identityId: string): string {
  return `${storagePrefix}:${identityId}`;
}

export class ArchivedNotifications {
  public get(identityId: string): string[] {
    const raw = window.localStorage.getItem(storageKey(identityId));

    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw) as unknown;

      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string')
        : [];
    } catch {
      return [];
    }
  }

  public has(identityId: string, notificationId: string): boolean {
    return this.get(identityId).includes(notificationId);
  }

  public archive(identityId: string, notificationId: string): string[] {
    const next = [...new Set([...this.get(identityId), notificationId])];

    window.localStorage.setItem(storageKey(identityId), JSON.stringify(next));

    return next;
  }
}
