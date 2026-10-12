/**
 * Decides which readers a mailbox keeps when its reader set is pruned. The
 * identity's own readers always stay. A legacy reader stays until every device
 * reader is listed, so a device that has not migrated keeps its path into the
 * inbox.
 */
export class MailboxReaderRetention {
  /**
   * Returns the listed reader hashes that must be removed.
   *
   * @param input.listed read-token hashes currently registered on the mailbox
   * @param input.devices hashes of the identity's device readers, always kept
   * @param input.retained hashes of the managing, root and sealed readers,
   *   always kept
   * @param input.legacy hashes kept only until every device reader is listed
   */
  public static readersToRemove(input: {
    devices: readonly string[];
    legacy: readonly string[];
    listed: readonly string[];
    retained: readonly string[];
  }): string[] {
    const listed = new Set(input.listed);
    const migrated = input.devices.every((hash) => listed.has(hash));
    const kept = new Set([
      ...input.retained,
      ...input.devices,
      ...(migrated ? [] : input.legacy),
    ]);

    return input.listed.filter((hash) => !kept.has(hash));
  }
}
