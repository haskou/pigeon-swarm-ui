import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { MailboxKeys } from '../../../mailboxes/infrastructure/crypto/MailboxKeySchedule';
import type { MailboxReadTokens } from '../../../mailboxes/infrastructure/MailboxChannel';

import { MailboxCapability } from '../../../mailboxes/infrastructure/crypto/MailboxCapability';
import { MailboxReadToken } from '../../../mailboxes/infrastructure/crypto/MailboxReadToken';
import { MailboxChannel } from '../../../mailboxes/infrastructure/MailboxChannel';

/**
 * Keeps the mailbox reader set in line with the identity's devices. A reader
 * whose device was removed is pruned, so it stops counting against the
 * node's reader cap.
 */
export class DirectMessageReaderSet {
  /** Mailboxes reconciled this app session. A failed pass is not kept. */
  private readonly reconciled = new Map<string, Promise<void>>();

  public constructor(
    private readonly channel: MailboxChannel,
    private readonly listCredentials: (
      session: Session,
    ) => Promise<readonly string[]>,
  ) {}

  /**
   * Prunes readers that no device of the identity holds. Runs once per
   * mailbox per app session; a failed pass is retried on the next sync. Never
   * rejects: a stale reader only delays envelope retention, so the read path
   * does not wait on a failure here.
   */
  public reconcile(
    session: Session,
    keys: MailboxKeys,
    readers: MailboxReadTokens,
  ): Promise<void> {
    const known = this.reconciled.get(keys.mailboxId);

    if (known) return known;

    const pass = this.prune(session, keys, readers).catch(() => {
      this.reconciled.delete(keys.mailboxId);
      // Count-only: no ids, content, or error details.
      // eslint-disable-next-line no-console
      console.debug(
        'Direct mailbox reader reconcile failed; retried next sync.',
      );
    });

    this.reconciled.set(keys.mailboxId, pass);

    return pass;
  }

  /**
   * Frees slots while a legacy inbox is not adopted yet. The legacy token is
   * the only reader that can manage it. Best effort and not memoised: the
   * adoption that follows reports a refusal, and the next sync prunes again.
   */
  public async pruneUnderLegacy(
    session: Session,
    keys: MailboxKeys,
    readers: MailboxReadTokens,
    legacyToken: string,
  ): Promise<void> {
    try {
      await this.prune(session, keys, readers, legacyToken);
    } catch {
      // Count-only: no ids, content, or error details.
      // eslint-disable-next-line no-console
      console.debug('Direct mailbox legacy reader prune failed.');
    }
  }

  /**
   * The managing token lists and removes readers, so it is always kept, as
   * are the root and device readers.
   */
  private async prune(
    session: Session,
    keys: MailboxKeys,
    readers: MailboxReadTokens,
    managingToken = readers.root,
  ): Promise<void> {
    const rootKey = session.masterKey.getBuffer();
    const kept = new Set<string>([
      MailboxCapability.hash(managingToken),
      MailboxCapability.hash(readers.root),
      MailboxCapability.hash(readers.device),
    ]);

    for (const credential of await this.listCredentials(session)) {
      const token = MailboxReadToken.deriveDevice(
        rootKey,
        keys.mailboxId,
        credential,
      );

      kept.add(MailboxCapability.hash(token));
    }

    const listed = await this.channel.listReaders(keys, managingToken);

    for (const reader of listed.readers) {
      if (!kept.has(reader.readTokenHash)) {
        await this.channel.removeReader(
          keys,
          managingToken,
          reader.readTokenHash,
        );
      }
    }
  }
}
