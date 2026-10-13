import type { Session } from '../../../identities/infrastructure/session/Session';
import type { MailboxKeys } from '../../../mailboxes/infrastructure/crypto/MailboxKeySchedule';
import type { MailboxReadTokens } from '../../../mailboxes/infrastructure/MailboxChannel';

import { sessionRootKey } from '../../../identities/infrastructure/session/sessionRootKey';
import { MailboxReaderRetention } from '../../../mailboxes/domain/MailboxReaderRetention';
import { MailboxCapability } from '../../../mailboxes/infrastructure/crypto/MailboxCapability';
import { MailboxReadToken } from '../../../mailboxes/infrastructure/crypto/MailboxReadToken';
import { MailboxChannel } from '../../../mailboxes/infrastructure/MailboxChannel';

/**
 * Keeps the mailbox reader set in line with the identity's devices. Each
 * device holds a reader derived from the root it opened. A reader whose
 * device was removed is pruned, so it stops counting against the node's
 * reader cap.
 */
export class DirectMessageReaderSet {
  /** Mailboxes reconciled this app session. A failed pass is not kept. */
  private readonly reconciled = new Map<string, Promise<void>>();
  /** Sealed roots bridged this app session. A failed bridge is not kept. */
  private readonly enrolled = new Map<string, Promise<void>>();

  public constructor(
    private readonly channel: MailboxChannel,
    private readonly listCredentials: (
      session: Session,
    ) => Promise<readonly string[]>,
  ) {}

  /**
   * The root reader lists and removes readers, so it is always kept, as is
   * this device's reader while the credential list lags.
   */
  private async prune(
    session: Session,
    keys: MailboxKeys,
    readers: MailboxReadTokens,
  ): Promise<void> {
    const credentials = await this.listCredentials(session);
    const rootKey = sessionRootKey(session).getBuffer();
    const listed = await this.channel.listReaders(keys, readers.root);
    const removable = MailboxReaderRetention.readersToRemove({
      devices: credentials.map((credential) =>
        MailboxCapability.hash(
          MailboxReadToken.deriveDevice(rootKey, keys.mailboxId, credential),
        ),
      ),
      listed: listed.readers.map((reader) => reader.readTokenHash),
      retained: [
        MailboxCapability.hash(readers.root),
        MailboxCapability.hash(readers.device),
      ],
    });

    for (const readTokenHash of removable) {
      await this.channel.removeReader(keys, readers.root, readTokenHash);
    }
  }

  /**
   * Enrols this device's reader under the root reader. Memoised per mailbox
   * and root.
   */
  public enrolSealedRoot(
    session: Session,
    keys: MailboxKeys,
    readers: MailboxReadTokens,
  ): Promise<void> {
    const key = `${keys.mailboxId}:${MailboxCapability.hash(readers.root)}`;
    const known = this.enrolled.get(key);

    if (known) return known;

    const enrol = this.channel
      .addReader(keys, readers.root, readers.device)
      .catch((error: unknown) => {
        this.enrolled.delete(key);

        throw error;
      });

    this.enrolled.set(key, enrol);

    return enrol;
  }

  /**
   * Prunes readers that no device of the identity holds, once per mailbox and
   * root per app session; a failed pass is retried on the next sync. Never
   * rejects: a stale reader only delays envelope retention, so the read path
   * does not wait on a failure here.
   */
  public reconcile(
    session: Session,
    keys: MailboxKeys,
    readers: MailboxReadTokens,
  ): Promise<void> {
    const key = `${keys.mailboxId}:${MailboxCapability.hash(readers.root)}`;
    const known = this.reconciled.get(key);

    if (known) return known;

    const pass = this.prune(session, keys, readers).catch(() => {
      this.reconciled.delete(key);
      // Count-only: no ids, content, or error details.
      // eslint-disable-next-line no-console
      console.debug(
        'Direct mailbox reader reconcile failed; retried next sync.',
      );
    });

    this.reconciled.set(key, pass);

    return pass;
  }
}
