/**
 * Decides which readers a mailbox keeps when its reader set is pruned. The
 * identity's own readers always stay.
 */
export class MailboxReaderRetention {
  /**
   * Returns the listed reader hashes that must be removed.
   *
   * @param input.listed read-token hashes currently registered on the mailbox
   * @param input.devices hashes of the identity's device readers, always kept
   * @param input.retained hashes of the root and this device's readers,
   *   always kept
   */
  public static readersToRemove(input: {
    devices: readonly string[];
    listed: readonly string[];
    retained: readonly string[];
  }): string[] {
    const kept = new Set([...input.retained, ...input.devices]);

    return input.listed.filter((hash) => !kept.has(hash));
  }
}
