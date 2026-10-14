import { Duration, Timestamp } from '@haskou/value-objects';
import { randomBytes } from '@noble/hashes/utils.js';

import type { MailboxKeys } from '../../../mailboxes/infrastructure/crypto/MailboxKeySchedule';
import type {
  MailboxChannel,
  OpenedMailboxEnvelope,
} from '../../../mailboxes/infrastructure/MailboxChannel';
import type { RecipientMailboxRouter } from '../../../messages/infrastructure/mailbox/RecipientMailboxRouter';
import type { ContactPresence } from '../../domain/ContactPresence';
import type { PresenceSharing } from '../../domain/PresenceSharing';
import type { ContactPresenceRepository } from '../../domain/repositories/ContactPresenceRepository';
import type { IdentityId } from '../../domain/value-objects/IdentityId';
import type { IdentityAccessContexts } from '../http/IdentityAccessContexts';
import type { Session } from '../session/Session';

import { encodeBase64Url } from '../../../../shared/infrastructure/encoding/base64url';
import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';
import { MailboxUnavailableError } from '../../../mailboxes/domain/errors/MailboxUnavailableError';
import { MailboxCapability } from '../../../mailboxes/infrastructure/crypto/MailboxCapability';
import { MailboxReadToken } from '../../../mailboxes/infrastructure/crypto/MailboxReadToken';
import { ContactPresenceBoard } from '../../domain/ContactPresenceBoard';
import { ContactPresenceBroadcast } from '../../domain/ContactPresenceBroadcast';
import { ContactPresenceSource } from '../../domain/value-objects/ContactPresenceSource';
import { ContactPresenceInboxCursor } from './ContactPresenceInboxCursor';
import { ContactPresenceInboxKeys } from './ContactPresenceInboxKeys';
import { ContactPresenceRecord } from './ContactPresenceRecord';

/**
 * Presence over opaque mailboxes. Each side of a direct conversation reads a
 * presence inbox of its own, keyed from the conversation key, whose only
 * reader derives from the identity's sealed root. Updates are sealed
 * end to end, so the relay sees an inbox id and ciphertext only.
 *
 * Every device keeps its own read position in memory and clears the inbox
 * only up to the first update still current, so the identity's other devices
 * read it too and a stale update leaves the relay once it expired. A sender
 * stops writing to a contact for two minutes after the inbox was missing.
 */
// eslint-disable-next-line max-len
export class MailboxContactPresenceRepository implements ContactPresenceRepository {
  private static readonly BACKOFF = Duration.fromMinutes(2);
  private static readonly PAGE_SIZE = 100;
  private static readonly PAGES = 10;
  private static readonly SOURCE_BYTES = 16;

  private readonly boards = new Map<string, ContactPresenceBoard>();
  private readonly broadcasts = new Map<string, ContactPresenceBroadcast>();
  private readonly cursors = new Map<string, ContactPresenceInboxCursor>();
  /** Inboxes opened this app session, by mailbox and reader. */
  private readonly opened = new Map<
    string,
    { identityId: string; keys: MailboxKeys; open: Promise<void> }
  >();

  private readonly resumeAt = new Map<string, Timestamp>();

  /**
   * The updates of one page. Each is held until it expires; an envelope that
   * is not an update from the contact is not held, so it is cleared.
   */
  private static take(
    envelopes: readonly OpenedMailboxEnvelope[],
    sharing: PresenceSharing,
    cursor: ContactPresenceInboxCursor,
    receivedAt: Timestamp,
  ): ContactPresence[] {
    return envelopes.flatMap(({ cursor: at, plaintext }) => {
      const presence = ContactPresenceRecord.decode(plaintext, sharing);

      if (!presence) return [];
      cursor.hold(at, presence.expiresOnReceiptAt(receivedAt));

      return [presence];
    });
  }

  private static isMissingInbox(error: unknown): boolean {
    return (
      error instanceof MailboxUnavailableError ||
      (error instanceof HttpJsonError && error.status === 409)
    );
  }

  public constructor(
    private readonly contexts: IdentityAccessContexts,
    private readonly channel: MailboxChannel,
    private readonly router: RecipientMailboxRouter,
  ) {}

  /**
   * Leaves `reader` the inbox's only reader. After a revoke rotated the
   * sealed root, the root it replaced adds the rotated one first.
   */
  private async keepOnly(
    session: Session,
    keys: MailboxKeys,
    reader: string,
  ): Promise<void> {
    const previous = session.previousDeviceSealedRootKey;

    if (previous) {
      await this.channel
        .addReader(
          keys,
          MailboxReadToken.derive(previous.getBuffer(), keys.mailboxId),
          reader,
        )
        .catch(() => undefined);
    }

    const kept = MailboxCapability.hash(reader);
    const { readers } = await this.channel.listReaders(keys, reader);

    for (const { readTokenHash } of readers) {
      if (readTokenHash !== kept) {
        await this.channel.removeReader(keys, reader, readTokenHash);
      }
    }
  }

  /** Creates or bridges into the inbox once per app session and reader. */
  private open(
    session: Session,
    keys: MailboxKeys,
    reader: string,
  ): Promise<void> {
    const key = `${keys.mailboxId}|${MailboxCapability.hash(reader)}`;
    const known = this.opened.get(key);

    if (known) return known.open;

    const open = this.channel
      .createInbox(keys, reader)
      .catch((error: unknown) => {
        if (!(error instanceof HttpJsonError && error.status === 409)) {
          throw error;
        }
      })
      .then(() => this.keepOnly(session, keys, reader))
      .catch((error: unknown) => {
        this.opened.delete(key);

        throw error;
      });

    this.opened.set(key, { identityId: session.identity.id, keys, open });

    return open;
  }

  private async read(
    keys: MailboxKeys,
    reader: string,
    sharing: PresenceSharing,
    receivedAt: Timestamp,
  ): Promise<ContactPresence[]> {
    const readers = { device: reader, root: reader };
    const cursor =
      this.cursors.get(keys.mailboxId) ?? new ContactPresenceInboxCursor();
    const received: ContactPresence[] = [];

    this.cursors.set(keys.mailboxId, cursor);

    for (
      let page = 0;
      page < MailboxContactPresenceRepository.PAGES;
      page += 1
    ) {
      const read = await this.channel.read(
        keys,
        readers,
        cursor.position(),
        MailboxContactPresenceRepository.PAGE_SIZE,
      );

      if (read.recreated) cursor.restart();

      received.push(
        ...MailboxContactPresenceRepository.take(
          read.envelopes,
          sharing,
          cursor,
          receivedAt,
        ),
      );
      cursor.advance(read.lastCursor);

      if (!read.hasMore) break;
    }

    const upTo = cursor.clearableAt(receivedAt);

    if (upTo !== null) {
      await this.channel.acknowledge(keys, readers, upTo);
      cursor.cleared(upTo);
    }

    return received;
  }

  private session(actorIdentityId: IdentityId): Session {
    return this.contexts.find(actorIdentityId).session;
  }

  public board(actorIdentityId: IdentityId): ContactPresenceBoard {
    const key = actorIdentityId.toString();
    const board = this.boards.get(key) ?? new ContactPresenceBoard();

    this.boards.set(key, board);

    return board;
  }

  public broadcast(actorIdentityId: IdentityId): ContactPresenceBroadcast {
    const key = actorIdentityId.toString();
    const broadcast =
      this.broadcasts.get(key) ??
      new ContactPresenceBroadcast(
        actorIdentityId,
        ContactPresenceSource.fromString(
          encodeBase64Url(
            randomBytes(MailboxContactPresenceRepository.SOURCE_BYTES),
          ),
        ),
      );

    this.broadcasts.set(key, broadcast);

    return broadcast;
  }

  public async close(
    actorIdentityId: IdentityId,
    sharing: PresenceSharing,
  ): Promise<void> {
    try {
      const session = this.session(actorIdentityId);
      const keys = ContactPresenceInboxKeys.keysFor(
        session,
        sharing.toPrimitives().conversationId,
        actorIdentityId.toString(),
      );

      if (!keys) return;

      for (const [key, { keys: opened }] of this.opened) {
        if (opened.mailboxId === keys.mailboxId) this.opened.delete(key);
      }
      this.cursors.delete(keys.mailboxId);
      await this.channel.deleteInbox(
        keys,
        ContactPresenceInboxKeys.readerFor(session, keys),
      );
    } catch {
      // eslint-disable-next-line no-console
      console.debug('Contact presence inbox close failed.');
    }
  }

  /**
   * Leaves the rotated sealed root the only reader of every presence inbox
   * this app session opened for the identity, so a revoked device reads no
   * later update. Rejects with the first failure once every inbox was tried;
   * an inbox opened later is pruned as it opens.
   */
  public async cutOffRevokedReaders(session: Session): Promise<void> {
    const failures: unknown[] = [];
    const inboxes = [...this.opened]
      .filter(([, { identityId }]) => identityId === session.identity.id)
      .map(([key, { keys }]) => ({ key, keys }));

    for (const { key, keys } of inboxes) {
      this.opened.delete(key);
      await this.open(
        session,
        keys,
        ContactPresenceInboxKeys.readerFor(session, keys),
      ).catch((error: unknown) => {
        failures.push(error);
      });
    }

    if (failures.length > 0) throw failures[0];
  }

  /** Drops every contact presence and inbox state held, for logout. */
  public dispose(): void {
    for (const held of [
      this.boards,
      this.broadcasts,
      this.cursors,
      this.opened,
      this.resumeAt,
    ]) {
      held.clear();
    }
  }

  /** Drops what this app session holds for the identity. */
  public forget(identityId: string): void {
    for (const [key, { identityId: owner, keys }] of this.opened) {
      if (owner === identityId) {
        this.opened.delete(key);
        this.cursors.delete(keys.mailboxId);
      }
    }
    for (const key of [...this.resumeAt.keys()]) {
      if (key.startsWith(`${identityId}|`)) this.resumeAt.delete(key);
    }
    this.boards.delete(identityId);
    this.broadcasts.delete(identityId);
  }

  public async publish(
    actorIdentityId: IdentityId,
    sharing: PresenceSharing,
    presence: ContactPresence,
  ): Promise<void> {
    const backoffKey = `${actorIdentityId.toString()}|${sharing.toPrimitives().conversationId}`;
    const sentAt = presence.getSentAt();

    if (this.resumeAt.get(backoffKey)?.isAfter(sentAt)) return;

    try {
      const contactId = sharing.getContactId().toString();
      const keys = ContactPresenceInboxKeys.keysFor(
        this.session(actorIdentityId),
        sharing.toPrimitives().conversationId,
        contactId,
      );

      if (!keys) return;

      await this.router.send(
        contactId,
        [],
        keys,
        ContactPresenceRecord.encode(sharing, presence),
      );
      this.resumeAt.delete(backoffKey);
    } catch (error: unknown) {
      if (MailboxContactPresenceRepository.isMissingInbox(error)) {
        this.resumeAt.set(
          backoffKey,
          sentAt.addDuration(MailboxContactPresenceRepository.BACKOFF),
        );
      }
      // eslint-disable-next-line no-console
      console.debug('Contact presence update was not delivered.');
    }
  }

  public async receive(
    actorIdentityId: IdentityId,
    sharing: PresenceSharing,
    receivedAt: Timestamp,
  ): Promise<ContactPresence[]> {
    try {
      const session = this.session(actorIdentityId);
      const keys = ContactPresenceInboxKeys.keysFor(
        session,
        sharing.toPrimitives().conversationId,
        actorIdentityId.toString(),
      );

      if (!keys) return [];

      const reader = ContactPresenceInboxKeys.readerFor(session, keys);

      await this.open(session, keys, reader);

      return await this.read(keys, reader, sharing, receivedAt);
    } catch {
      // eslint-disable-next-line no-console
      console.debug('Contact presence inbox read failed.');

      return [];
    }
  }
}
