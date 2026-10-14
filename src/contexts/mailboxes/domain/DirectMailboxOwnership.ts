import type { IdentityId } from '../../identities/domain/value-objects/IdentityId';

/** Own-copy identity for direct mailbox records. */
export class DirectMailboxOwnership {
  /** Key for a record this device appended to its own inbox. */
  public static ownCopyKey(identity: IdentityId, recordId: string): string {
    return `${identity.valueOf()}:${recordId}`;
  }
}
