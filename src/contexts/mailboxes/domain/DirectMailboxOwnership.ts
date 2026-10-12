/** Authorship and own-copy identity for direct mailbox records. */
export class DirectMailboxOwnership {
  public static isAuthoredBy(authorId: string, identityId: string): boolean {
    return authorId === identityId;
  }

  /** Key for a record this device appended to its own inbox. */
  public static ownCopyKey(identityId: string, recordId: string): string {
    return `${identityId}:${recordId}`;
  }
}
