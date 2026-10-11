import type { MailboxCreationMiner } from '../MailboxChannel';
import type { MailboxCreationWorkerClient } from './MailboxCreationWorkerClient';

import { createMailboxWorkerClient } from './createMailboxWorkerClient';

/** Starts the proof-of-work worker on first use so sessions that never touch mailboxes never spawn it. */
export class LazyMailboxCreationMiner {
  private client: MailboxCreationWorkerClient | null = null;

  public readonly mine: MailboxCreationMiner = (
    mailboxId,
    postTokenHash,
    readTokenHash,
    difficultyBits,
  ) => {
    this.client ??= createMailboxWorkerClient();

    return this.client.mine(
      mailboxId,
      postTokenHash,
      readTokenHash,
      difficultyBits,
    );
  };

  public dispose(): void {
    this.client?.dispose();
    this.client = null;
  }
}
