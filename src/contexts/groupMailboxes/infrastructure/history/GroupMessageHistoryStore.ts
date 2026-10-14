import type { Session } from '../../../identities/infrastructure/session/Session';
import type { DirectMessageRecord } from '../../../mailboxes/domain/DirectMessageRecord';
import type { GroupConversationActivity } from '../GroupConversationActivity';
import type { GroupMessageHistoryRow } from './GroupMessageHistoryRow';

import { scopeClientStorageKey } from '../../../../shared/infrastructure/storage/ClientStorageScope';
import { DirectMailboxRecords } from '../../../mailboxes/domain/DirectMailboxRecords';
import { DeviceRootRowKeys } from '../../../messages/infrastructure/mailbox/DeviceRootRowKeys';
import { GroupMessageHistoryConversation } from './GroupMessageHistoryConversation';
import { GroupMessageHistoryDatabase } from './GroupMessageHistoryDatabase';
import { GroupMessageHistoryScope } from './GroupMessageHistoryScope';
import { GroupMessageReadMarker } from './GroupMessageReadMarker';

/**
 * The accepted records of this identity's group conversations, each sealed
 * with AES-256-GCM under a key derived from the device-sealed root, with the
 * row's identity and tags as AAD. Rows are indexed by keyed tags, so neither
 * a conversation nor a record id is readable at rest. A record stored twice,
 * as after a crash before its page was acknowledged, is kept once.
 *
 * History is read in pages of the latest arrivals: a page opens only rows
 * not opened before, and opened records stay in memory, so reopening a
 * conversation decrypts nothing again. A canary detects a root change; the
 * identity's rows are then dropped. Without a device-sealed root the store
 * keeps nothing. Calls run one at a time, so memory follows the database.
 *
 * Each conversation keeps a sealed read marker: the last row sequence it
 * accounted, the messages of other members since the last read on this
 * device, and the newest message time. Appending accounts the new records
 * without opening stored rows; rows stored after the marker, as after a
 * crash in between, are opened and accounted on the next call. History
 * stored before any marker counts as read.
 */
export class GroupMessageHistoryStore {
  /** How many stored rows a first marker opens to find the newest message. */
  private static readonly LATEST_LOOKBACK = 50;

  private readonly database: GroupMessageHistoryDatabase;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly scopes = new Map<string, GroupMessageHistoryScope>();

  private static aad(
    identityId: string,
    row: Pick<GroupMessageHistoryRow, 'conversation' | 'record'>,
  ): Uint8Array<ArrayBuffer> {
    return new TextEncoder().encode(
      JSON.stringify(['record', identityId, row.conversation, row.record]),
    );
  }

  private static readAad(
    identityId: string,
    conversation: string,
  ): Uint8Array<ArrayBuffer> {
    return new TextEncoder().encode(
      JSON.stringify(['read', identityId, conversation]),
    );
  }

  public constructor(
    databaseName: string = scopeClientStorageKey('pigeon-group-history'),
  ) {
    this.database = new GroupMessageHistoryDatabase(databaseName);
  }

  private async conversation(
    scope: GroupMessageHistoryScope,
    conversationId: string,
  ): Promise<GroupMessageHistoryConversation> {
    const held = scope.conversations.get(conversationId);

    if (held) return held;
    const conversation = new GroupMessageHistoryConversation(
      await scope.keys.tag(['conversation', conversationId]),
    );

    scope.conversations.set(conversationId, conversation);

    return conversation;
  }

  /** Runs `work` after every earlier call. */
  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work);

    this.queue = result.catch(() => undefined);

    return result;
  }

  /**
   * The marker of a conversation stored before any marker: every row not in
   * `known` counts as read, and the newest message time comes from opening
   * at most LATEST_LOOKBACK of those rows, newest first.
   */
  private async firstMarker(
    scope: GroupMessageHistoryScope,
    identityId: string,
    sequences: readonly number[],
    known: ReadonlyMap<number, DirectMessageRecord>,
  ): Promise<GroupMessageReadMarker> {
    const read = sequences.filter((sequence) => !known.has(sequence));
    const through = read[read.length - 1] ?? 0;
    const now = Date.now();

    for (const sequence of read
      .slice(-GroupMessageHistoryStore.LATEST_LOOKBACK)
      .reverse()) {
      const [row] = await this.database.rows([sequence]);
      const record = row
        ? await this.openRow(scope, identityId, row)
        : undefined;

      if (record?.type === DirectMailboxRecords.TYPE.sent) {
        return GroupMessageReadMarker.fresh(
          through,
          Math.min(record.createdAt, now),
        );
      }
    }

    return GroupMessageReadMarker.fresh(through, 0);
  }

  /** Opens and reads one record of `conversation` on its own. */
  private async lookUp(
    scope: GroupMessageHistoryScope,
    identityId: string,
    conversationId: string,
    id: string,
  ): Promise<DirectMessageRecord | undefined> {
    const conversation = await this.conversation(scope, conversationId);
    const row = await this.database.row(
      identityId,
      conversation.tag,
      await scope.keys.tag(['record', conversationId, id]),
    );
    const [record] = await this.opened(scope, identityId, row ? [row] : []);

    if (record) conversation.remember(record);

    return record;
  }

  /** Reads and opens up to `count` rows below the conversation's floor. */
  private async loadOlder(
    scope: GroupMessageHistoryScope,
    identityId: string,
    conversation: GroupMessageHistoryConversation,
    count: number,
  ): Promise<void> {
    const older = (
      await this.database.sequences(identityId, conversation.tag)
    ).filter((sequence) => sequence < conversation.floor());
    const wanted = older.slice(-count);
    const rows = await this.database.rows(wanted);

    conversation.addOlder(
      await this.opened(
        scope,
        identityId,
        rows.filter((row) => row !== undefined),
      ),
      wanted[0] ?? conversation.floor(),
      older.length <= count,
    );
  }

  /** The stored read marker of one conversation tag, if it opens. */
  private async marker(
    scope: GroupMessageHistoryScope,
    identityId: string,
    conversation: string,
  ): Promise<GroupMessageReadMarker | undefined> {
    const sealed = await this.database.read(identityId, conversation);
    const plaintext = sealed
      ? await scope.keys.cipher.open(
          GroupMessageHistoryStore.readAad(identityId, conversation),
          sealed,
        )
      : undefined;

    if (!plaintext) return undefined;

    try {
      return GroupMessageReadMarker.parse(
        JSON.parse(new TextDecoder().decode(plaintext)),
      );
    } catch {
      return undefined;
    }
  }

  /** The records of the rows that open under this scope, in row order. */
  private async opened(
    scope: GroupMessageHistoryScope,
    identityId: string,
    rows: readonly GroupMessageHistoryRow[],
  ): Promise<DirectMessageRecord[]> {
    return (
      await Promise.all(rows.map((row) => this.openRow(scope, identityId, row)))
    ).filter((record) => record !== undefined);
  }

  /** The record of one row; undefined when it does not open. */
  private async openRow(
    scope: GroupMessageHistoryScope,
    identityId: string,
    row: GroupMessageHistoryRow,
  ): Promise<DirectMessageRecord | undefined> {
    const plaintext = await scope.keys.cipher.open(
      GroupMessageHistoryStore.aad(identityId, row),
      row.sealed,
    );

    return plaintext
      ? (JSON.parse(new TextDecoder().decode(plaintext)) as DirectMessageRecord)
      : undefined;
  }

  /** The identity's scope under the session's root; undefined without one. */
  private async scope(
    session: Session,
  ): Promise<GroupMessageHistoryScope | undefined> {
    const root = session.deviceSealedRootKey?.getBuffer();

    if (!root) return undefined;
    const identityId = session.identity.id;
    const held = this.scopes.get(identityId);

    if (held?.opensUnder(root)) return held;
    const keys = await DeviceRootRowKeys.derive(
      root,
      'pigeon-group-history',
      identityId,
    );
    const canary = await this.database.canary(identityId);

    if (!canary || !(await keys.cipher.opensCanary(canary))) {
      await this.database.reset(identityId, await keys.cipher.sealCanary());
    }
    const scope = new GroupMessageHistoryScope(root, keys);

    this.scopes.set(identityId, scope);

    return scope;
  }

  private async sealed(
    scope: GroupMessageHistoryScope,
    identityId: string,
    record: DirectMessageRecord,
  ): Promise<GroupMessageHistoryRow> {
    const tags = {
      conversation: await scope.keys.tag([
        'conversation',
        record.conversationId,
      ]),
      record: await scope.keys.tag([
        'record',
        record.conversationId,
        record.id,
      ]),
    };

    return {
      ...tags,
      identityId,
      sealed: await scope.keys.cipher.seal(
        GroupMessageHistoryStore.aad(identityId, tags),
        new TextEncoder().encode(JSON.stringify(record)),
      ),
    };
  }

  /**
   * Accounts the conversation's rows after its read marker, then applies
   * `change` and stores the marker if it differs. `known` holds the records
   * of rows this call just stored, so they are not opened again. Without a
   * marker, every row not in `known` counts as read.
   */
  private async settle(
    scope: GroupMessageHistoryScope,
    identityId: string,
    conversationId: string,
    known: ReadonlyMap<number, DirectMessageRecord>,
    change: (
      marker: GroupMessageReadMarker,
      lastSequence: number,
    ) => GroupMessageReadMarker = (marker) => marker,
  ): Promise<GroupMessageReadMarker> {
    const tag =
      scope.conversations.get(conversationId)?.tag ??
      (await scope.keys.tag(['conversation', conversationId]));
    const stored = await this.marker(scope, identityId, tag);
    const sequences = await this.database.sequences(identityId, tag);
    // Sequences come in arrival order, so the last one is the highest.
    const lastSequence = sequences[sequences.length - 1] ?? 0;
    const base =
      stored ?? (await this.firstMarker(scope, identityId, sequences, known));
    const after = sequences.filter(
      (sequence) => sequence > base.lastSequence(),
    );
    const unknown = after.filter((sequence) => !known.has(sequence));
    const unknownRows = await this.database.rows(unknown);
    const openedRecords = new Map<number, DirectMessageRecord>();

    await Promise.all(
      unknownRows.map(async (row, index) => {
        const record = row
          ? await this.openRow(scope, identityId, row)
          : undefined;

        if (record) openedRecords.set(unknown[index], record);
      }),
    );
    const records = after
      .map((sequence) => known.get(sequence) ?? openedRecords.get(sequence))
      .filter((record) => record !== undefined);
    const next = change(
      base.accounted(lastSequence, records, identityId, Date.now()),
      lastSequence,
    );

    if (!next.equals(stored)) {
      await this.database.putRead(
        identityId,
        tag,
        await scope.keys.cipher.seal(
          GroupMessageHistoryStore.readAad(identityId, tag),
          new TextEncoder().encode(JSON.stringify(next.toPrimitives())),
        ),
      );
    }

    return next;
  }

  /**
   * The newest message time and unread count of one conversation on this
   * device. Rejects on failure.
   */
  public activity(
    session: Session,
    conversationId: string,
  ): Promise<GroupConversationActivity> {
    return this.exclusive(async () => {
      const scope = await this.scope(session);

      if (!scope) return { latestMessageAt: undefined, unreadCount: 0 };
      const marker = await this.settle(
        scope,
        session.identity.id,
        conversationId,
        new Map(),
      );

      return {
        latestMessageAt: marker.latestMessageAt(),
        unreadCount: marker.unreadCount(),
      };
    });
  }

  /**
   * Stores the records, once per id, and accounts them in their
   * conversations' read markers. Rejects when the records are not stored; a
   * failed count is logged and caught up by the next call.
   */
  public append(
    session: Session,
    records: readonly DirectMessageRecord[],
  ): Promise<void> {
    return this.exclusive(async () => {
      const scope = await this.scope(session);

      if (!scope || records.length === 0) return;
      const identityId = session.identity.id;
      const stored = new Map<string, Map<number, DirectMessageRecord>>();

      try {
        const sequences = await this.database.insert(
          await Promise.all(
            records.map((record) => this.sealed(scope, identityId, record)),
          ),
        );

        records.forEach((record, index) => {
          const sequence = sequences[index];

          if (sequence === undefined) return;
          scope.conversations
            .get(record.conversationId)
            ?.addNewer(record, sequence);
          const known =
            stored.get(record.conversationId) ??
            new Map<number, DirectMessageRecord>();

          known.set(sequence, record);
          stored.set(record.conversationId, known);
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.debug('Group history save failed.', { count: records.length });

        throw error;
      }

      for (const [conversationId, known] of stored) {
        try {
          await this.settle(scope, identityId, conversationId, known);
        } catch {
          // eslint-disable-next-line no-console
          console.debug('Group unread count failed.', { count: known.size });
        }
      }
    });
  }

  /** The author of sent message `id`, if this device stored it. */
  public author(
    session: Session,
    conversationId: string,
    id: string,
  ): Promise<string | undefined> {
    return this.exclusive(async () => {
      const scope = await this.scope(session);

      if (!scope) return undefined;
      const held = scope.conversations.get(conversationId);
      const record =
        held?.find(id) ??
        (held?.isComplete()
          ? undefined
          : await this.lookUp(scope, session.identity.id, conversationId, id));

      return record?.type === DirectMailboxRecords.TYPE.sent
        ? record.authorId
        : undefined;
    });
  }

  /** Wipes one identity's history. Never throws; logs one line. */
  public forget(identityId: string): Promise<void> {
    return this.exclusive(async () => {
      this.scopes.delete(identityId);

      try {
        await this.database.wipe(identityId);
      } catch {
        // eslint-disable-next-line no-console
        console.debug('Group history forget failed.');
      }
    });
  }

  /**
   * The latest `limit` arrivals of one conversation, once each, ordered by
   * creation time. Opens only rows no earlier call opened.
   */
  public load(
    session: Session,
    conversationId: string,
    limit: number,
  ): Promise<DirectMessageRecord[]> {
    return this.exclusive(async () => {
      const scope = await this.scope(session);

      if (!scope) return [];
      const conversation = await this.conversation(scope, conversationId);
      const missing = conversation.missing(limit);

      if (missing > 0) {
        await this.loadOlder(scope, session.identity.id, conversation, missing);
      }

      return conversation.latest(limit);
    });
  }

  /** Marks every stored message of one conversation read on this device. */
  public markRead(session: Session, conversationId: string): Promise<void> {
    return this.exclusive(async () => {
      const scope = await this.scope(session);

      if (!scope) return;
      await this.settle(
        scope,
        session.identity.id,
        conversationId,
        new Map(),
        (marker, lastSequence) => marker.read(lastSequence),
      );
    });
  }
}
