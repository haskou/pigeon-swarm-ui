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
   * Bridges the device-sealed root into the mailbox. The legacy root reader is
   * added first, best effort, because only it can add the sealed root reader
   * to an inbox created before rotation. The sealed device reader must
   * succeed. Memoised per mailbox and root.
   */
  public enrolSealedRoot(
    session: Session,
    keys: MailboxKeys,
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
   * Prunes readers that no device of the identity holds. Runs only under a
   * device-sealed session, once per mailbox and root per app session; a failed
   * pass is retried on the next sync. Never rejects: a stale reader only delays
   * envelope retention, so the read path does not wait on a failure here.
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

  /**
   * Frees slots while a legacy inbox is not adopted yet, under a device-sealed
   * session only (see prune). The legacy token is the only reader that can
   * manage it. Best effort and not memoised: the adoption that follows reports
   * a refusal, and the next sync prunes again.
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

  private async bridge(
    session: Session,
    keys: MailboxKeys,
    readers: MailboxReadTokens,
  ): Promise<void> {
    const legacyRoot = MailboxReadToken.derive(
      session.masterKey.getBuffer(),
      keys.mailboxId,
    );

    try {
      await this.channel.addReader(keys, legacyRoot, readers.root);
    } catch {
      // Best effort: the inbox may already be past the legacy root.
    }

    await this.channel.addReader(keys, readers.root, readers.device);
  }

  /**
   * Runs under a device-sealed session only. A masterKey-only session cannot
   * tell a removed device's reader from a bridged device's sealed reader, so
   * it removes nothing and never locks a bridged device out.
   *
   * The managing token lists and removes readers, so it is always kept, as
   * are the root and device readers and the session's own sealed root reader.
   * The legacy readers stay until every listed device holds its sealed device
   * reader.
   */
  private async prune(
    session: Session,
    keys: MailboxKeys,
    readers: MailboxReadTokens,
    managingToken = readers.root,
  ): Promise<void> {
    if (!session.deviceSealedRootKey) return;

    const credentials = await this.listCredentials(session);
    const rootKey = sessionRootKey(session).getBuffer();
    const deviceTokens = credentials.map((credential) =>
      MailboxReadToken.deriveDevice(rootKey, keys.mailboxId, credential),
    );
    const legacyKey = session.masterKey.getBuffer();
    const listed = await this.channel.listReaders(keys, managingToken);
    const removable = MailboxReaderRetention.readersToRemove({
      devices: deviceTokens.map((token) => MailboxCapability.hash(token)),
      legacy: [
        MailboxCapability.hash(
          MailboxReadToken.derive(legacyKey, keys.mailboxId),
        ),
        ...credentials.map((credential) =>
          MailboxCapability.hash(
            MailboxReadToken.deriveDevice(
              legacyKey,
              keys.mailboxId,
              credential,
            ),
          ),
        ),
      ],
      listed: listed.readers.map((reader) => reader.readTokenHash),
      retained: [
        MailboxCapability.hash(managingToken),
        MailboxCapability.hash(readers.root),
        MailboxCapability.hash(readers.device),
        // The session's sealed root reader stays even when prune runs on the
        // legacy set after a refused bridge.
        MailboxCapability.hash(
          MailboxReadToken.derive(rootKey, keys.mailboxId),
        ),
      ],
    });

    for (const readTokenHash of removable) {
      await this.channel.removeReader(keys, managingToken, readTokenHash);
    }
  }
}
