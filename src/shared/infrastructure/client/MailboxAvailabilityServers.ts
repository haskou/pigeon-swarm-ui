import { MailboxHomeBase } from './MailboxHomeBase';

/**
 * Extra nodes that hold a copy of a recipient's direct inbox, so a message
 * still lands while the recipient's home is down. Each is a canonical public
 * mailbox base, at most MAX_SERVERS of them, without duplicates.
 */
export class MailboxAvailabilityServers {
  public static readonly MAX_SERVERS = 3;

  /**
   * The servers this deployment picks from its comma-separated config. Each
   * entry resolves against the page origin as an API base does; entries that
   * are not publishable, repeat, or name the connected node are skipped. Reads
   * the page origin only when something is configured.
   */
  public static pick(
    configured: string,
    apiBase: string,
    pageOrigin: () => string,
  ): string[] {
    const entries = configured
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '');

    if (entries.length === 0) return [];

    const origin = pageOrigin();
    const connected = MailboxHomeBase.fromApiBase(apiBase, origin);
    const picked = new Set<string>();

    for (const entry of entries) {
      const base = MailboxHomeBase.fromApiBase(entry, origin);

      if (base !== undefined && base !== connected) picked.add(base);
    }

    return [...picked].slice(0, MailboxAvailabilityServers.MAX_SERVERS);
  }

  /** An announced or stored list, or undefined if any entry fails. */
  public static parse(value: unknown): string[] | undefined {
    if (
      !Array.isArray(value) ||
      value.length > MailboxAvailabilityServers.MAX_SERVERS
    ) {
      return undefined;
    }

    const servers = value.filter(
      (entry): entry is string =>
        typeof entry === 'string' && MailboxHomeBase.parse(entry) === entry,
    );

    return servers.length === value.length &&
      new Set(servers).size === servers.length
      ? servers
      : undefined;
  }
}
