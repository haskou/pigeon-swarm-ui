import { MailboxAvailabilityServers } from '../../../../shared/infrastructure/client/MailboxAvailabilityServers';
import { scopeClientStorageKey } from '../../../../shared/infrastructure/storage/ClientStorageScope';
import {
  readJsonObjectFromLocalStorage,
  writeJsonToLocalStorage,
} from '../../../../shared/infrastructure/storage/jsonLocalStorage';

/**
 * Availability servers per direct inbox, kept in scoped client storage: the
 * list a peer announced for its inbox, and the list this device last
 * announced for its own. Both are keyed by the inbox mailbox id.
 */
export class DirectMessageAvailabilityStore {
  private static readonly SERVERS_PREFIX = 'pigeon.direct-mailbox-servers.';
  private static readonly ANNOUNCED_PREFIX = 'pigeon.direct-mailbox-announced.';

  private stored(mailboxId: string): { createdAt: number; servers: string[] } {
    const stored = readJsonObjectFromLocalStorage<{
      createdAt?: unknown;
      servers?: unknown;
    }>(
      scopeClientStorageKey(
        `${DirectMessageAvailabilityStore.SERVERS_PREFIX}${mailboxId}`,
      ),
      {},
    );
    const servers = MailboxAvailabilityServers.parse(stored.servers);

    return typeof stored.createdAt === 'number' && servers !== undefined
      ? { createdAt: stored.createdAt, servers }
      : { createdAt: -1, servers: [] };
  }

  /** The servers the peer announced for this inbox, none by default. */
  public servers(mailboxId: string): string[] {
    return this.stored(mailboxId).servers;
  }

  /** Keeps the newest announcement; an older or equal one is ignored. */
  public record(
    mailboxId: string,
    createdAt: number,
    servers: readonly string[],
  ): void {
    if (createdAt <= this.stored(mailboxId).createdAt) return;

    writeJsonToLocalStorage(
      scopeClientStorageKey(
        `${DirectMessageAvailabilityStore.SERVERS_PREFIX}${mailboxId}`,
      ),
      { createdAt, servers },
    );
  }

  /** The servers last announced for this device's own inbox. */
  public announced(mailboxId: string): string[] {
    const stored = readJsonObjectFromLocalStorage<{ servers?: unknown }>(
      scopeClientStorageKey(
        `${DirectMessageAvailabilityStore.ANNOUNCED_PREFIX}${mailboxId}`,
      ),
      {},
    );

    return MailboxAvailabilityServers.parse(stored.servers) ?? [];
  }

  public saveAnnounced(mailboxId: string, servers: readonly string[]): void {
    writeJsonToLocalStorage(
      scopeClientStorageKey(
        `${DirectMessageAvailabilityStore.ANNOUNCED_PREFIX}${mailboxId}`,
      ),
      { servers },
    );
  }
}
