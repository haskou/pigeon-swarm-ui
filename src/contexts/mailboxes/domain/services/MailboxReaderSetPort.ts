/** One mailbox's reader set, managed through the identity's root reader. */
export interface MailboxReaderSetPort {
  /** Read-token hashes of the readers held by the identity's devices. */
  deviceReaders(): Promise<readonly string[]>;
  /** Read-token hashes currently registered on the mailbox. */
  listedReaders(): Promise<readonly string[]>;
  removeReader(readTokenHash: string): Promise<void>;
  /** Read-token hashes of the root and this device's readers. */
  retainedReaders(): readonly string[];
}
