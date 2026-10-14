import type { IdentityId } from '../../identities/domain/value-objects/IdentityId';

/** Authorship and own-copy identity for direct mailbox records. */
export class DirectMailboxOwnership {
  public static isAuthoredBy(
    author: IdentityId,
    identity: IdentityId,
  ): boolean {
    return author.isEqual(identity);
  }

  /** Key for a record this device appended to its own inbox. */
  public static ownCopyKey(identity: IdentityId, recordId: string): string {
    return `${identity.valueOf()}:${recordId}`;
  }
}
