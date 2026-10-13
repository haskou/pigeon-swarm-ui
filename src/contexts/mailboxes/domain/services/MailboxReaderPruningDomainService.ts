import type { MailboxReaderSetPort } from './MailboxReaderSetPort';

import { MailboxReaderRetention } from '../MailboxReaderRetention';

/**
 * Prunes a mailbox reader set so readers of removed devices stop counting
 * against the node's reader cap. MailboxReaderRetention decides which readers
 * go; they are removed one at a time, and the first failure stops the pass.
 */
export class MailboxReaderPruningDomainService {
  public static async prune(port: MailboxReaderSetPort): Promise<void> {
    const devices = await port.deviceReaders();
    const listed = await port.listedReaders();
    const removable = MailboxReaderRetention.readersToRemove({
      devices,
      listed,
      retained: port.retainedReaders(),
    });

    for (const readTokenHash of removable) {
      await port.removeReader(readTokenHash);
    }
  }
}
