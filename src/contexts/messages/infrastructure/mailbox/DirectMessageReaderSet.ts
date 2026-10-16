import type { MailboxInboxKeys } from '@haskou/pigeon-swarm-crypto';

import { MailboxReadToken } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../identities/infrastructure/session/Session';
import type { MailboxReadTokens } from '../../../mailboxes/infrastructure/MailboxChannel';

import { sessionRootKey } from '../../../identities/infrastructure/session/sessionRootKey';
import { MailboxUnavailableError } from '../../../mailboxes/domain/errors/MailboxUnavailableError';
import { MailboxReaderPruningDomainService } from '../../../mailboxes/domain/services/MailboxReaderPruningDomainService';
import { MailboxCapability } from '../../../mailboxes/infrastructure/crypto/MailboxCapability';
import { MailboxChannel } from '../../../mailboxes/infrastructure/MailboxChannel';
import { DirectMessageReaderCutOffError } from './DirectMessageReaderCutOffError';

/**
 * Keeps the mailbox reader set in line with the identity's devices. Each
 * device holds a reader derived from the root it opened. A reader whose
 * device was removed is pruned, so it stops counting against the node's
 * reader cap, and after a revoke the pruned readers no longer open records
 * written to the inbox.
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
   * this device's reader while the credential list lags. The pass itself is
   * MailboxReaderPruningDomainService.
   */
  private prune(
    session: Session,
    keys: MailboxInboxKeys,
    readers: MailboxReadTokens,
  ): Promise<void> {
    return MailboxReaderPruningDomainService.prune({
      deviceReaders: async () => {
        const credentials = await this.listCredentials(session);
        const rootKey = sessionRootKey(session);

        return credentials.map((credential) =>
          MailboxCapability.hash(
            MailboxReadToken.deriveDevice(rootKey, keys.mailboxId, credential),
          ),
        );
      },
      listedReaders: async () => {
        const listed = await this.channel.listReaders(keys, readers.root);

        return listed.readers.map((reader) => reader.readTokenHash);
      },
      removeReader: (readTokenHash) =>
        this.channel.removeReader(keys, readers.root, readTokenHash),
      retainedReaders: () => [
        MailboxCapability.hash(readers.root),
        MailboxCapability.hash(readers.device),
      ],
    });
  }

  /**
   * After a revoke rotated the sealed root, the previous root still manages an
   * inbox created before it, so it adds the new root reader first, best
   * effort. Then the device reader must succeed.
   */
  private async bridge(
    session: Session,
    keys: MailboxInboxKeys,
    readers: MailboxReadTokens,
  ): Promise<void> {
    const previous = session.previousDeviceSealedRootKey;

    if (previous) {
      try {
        await this.channel.addReader(
          keys,
          MailboxReadToken.derive(previous, keys.mailboxId),
          readers.root,
        );
      } catch {
        // Best effort: the inbox may already be past the previous root.
      }
    }

    await this.channel.addReader(keys, readers.root, readers.device);
  }

  /** Prunes once per mailbox and root; a failed pass is dropped, rethrown. */
  private prunePass(
    session: Session,
    keys: MailboxInboxKeys,
    readers: MailboxReadTokens,
  ): Promise<void> {
    const key = `${keys.mailboxId}:${MailboxCapability.hash(readers.root)}`;
    const known = this.reconciled.get(key);

    if (known) return known;

    const pass = this.prune(session, keys, readers).catch((error: unknown) => {
      this.reconciled.delete(key);

      throw error;
    });

    this.reconciled.set(key, pass);

    return pass;
  }

  /**
   * The rotated root could not reach the inbox, so nothing was pruned there.
   * Rejects while the root the revoke replaced still reads it.
   */
  private async requireClosedToPreviousRoot(
    session: Session,
    keys: MailboxInboxKeys,
  ): Promise<void> {
    const previous = session.previousDeviceSealedRootKey;

    if (!previous) return;

    try {
      await this.channel.listReaders(
        keys,
        MailboxReadToken.derive(previous, keys.mailboxId),
      );
    } catch (error: unknown) {
      if (error instanceof MailboxUnavailableError) return;

      throw error;
    }

    throw new DirectMessageReaderCutOffError();
  }

  /**
   * Enrols this device's reader under the root reader, bridging through the
   * root a revoke replaced. Memoised per mailbox and root.
   */
  public enrolSealedRoot(
    session: Session,
    keys: MailboxInboxKeys,
    readers: MailboxReadTokens,
  ): Promise<void> {
    const key = `${keys.mailboxId}:${MailboxCapability.hash(readers.root)}`;
    const known = this.enrolled.get(key);

    if (known) return known;

    const enrol = this.bridge(session, keys, readers).catch(
      (error: unknown) => {
        this.enrolled.delete(key);

        throw error;
      },
    );

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
    keys: MailboxInboxKeys,
    readers: MailboxReadTokens,
  ): Promise<void> {
    return this.prunePass(session, keys, readers).catch(() => {
      // Count-only: no ids, content, or error details.
      // eslint-disable-next-line no-console
      console.debug(
        'Direct mailbox reader reconcile failed; retried next sync.',
      );
    });
  }

  /**
   * A revoke's cut-off of one inbox: bridges the rotated root in, then prunes
   * every reader no remaining device holds, joining a pass already running.
   * Rejects when either fails, or when the rotated root cannot reach an inbox
   * the replaced root still reads. An inbox neither root reaches has nothing
   * to cut off.
   */
  public async cutOff(
    session: Session,
    keys: MailboxInboxKeys,
    readers: MailboxReadTokens,
  ): Promise<void> {
    try {
      await this.enrolSealedRoot(session, keys, readers);
      await this.prunePass(session, keys, readers);
    } catch (error: unknown) {
      if (!(error instanceof MailboxUnavailableError)) throw error;

      await this.requireClosedToPreviousRoot(session, keys);
    }
  }
}
