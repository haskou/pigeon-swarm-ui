import type { IdentityId } from './value-objects/IdentityId';
import type { IdentityVersion } from './value-objects/IdentityVersion';
import type { KeychainVersion } from './value-objects/KeychainVersion';

/**
 * Selects between the identity state already held and an incoming snapshot of
 * it (a refresh result or a fetched identity). A snapshot is built from the
 * state it started with, so it can predate a newer identity or keychain held
 * since. A snapshot of another identity is discarded. Each versioned part only
 * moves forward: the incoming part is taken unless it is older than the held
 * one.
 */
export class IdentitySnapshotSelection {
  public static selectIdentity(
    held: { id: IdentityId; version: IdentityVersion },
    incoming: { id: IdentityId; version: IdentityVersion },
  ): 'discard' | 'held' | 'incoming' {
    if (!held.id.isEqual(incoming.id)) return 'discard';

    return incoming.version.isLessThan(held.version) ? 'held' : 'incoming';
  }

  public static selectKeychain(
    held: KeychainVersion,
    incoming: KeychainVersion,
  ): 'held' | 'incoming' {
    return incoming.isLessThan(held) ? 'held' : 'incoming';
  }
}
