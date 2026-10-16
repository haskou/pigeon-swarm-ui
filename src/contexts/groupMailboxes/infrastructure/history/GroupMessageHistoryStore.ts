import {
  DeviceRootRowKeys,
  type SymmetricKey,
} from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../identities/infrastructure/session/Session';
import type { DirectMessageRecord } from '../../../mailboxes/domain/DirectMessageRecord';
import type { DeviceSealedRowRoots as Roots } from '../../../messages/infrastructure/mailbox/DeviceSealedRowRoots';
import type { DeviceSealedSettlement as Settlement } from '../../../messages/infrastructure/mailbox/DeviceSealedSettlement';
import type { GroupConversationActivity } from '../GroupConversationActivity';
import type { GroupMessageHistoryResealer } from './GroupMessageHistoryResealer';
import type { GroupMessageHistoryRow } from './GroupMessageHistoryRow';

import { scopeClientStorageKey } from '../../../../shared/infrastructure/storage/ClientStorageScope';
import { DirectMailboxRecords } from '../../../mailboxes/domain/DirectMailboxRecords';
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
 * conversation decrypts nothing again. Without a device-sealed root the
 * store keeps nothing. Calls run one at a time, so memory follows the
 * database.
 *
 * A canary record settles the device-sealed root once per root and store
 * (`DeviceSealedCanaryRecords`). Under the root the session replaced, as
 * after a device revoke, every row and read marker is re-sealed under the
 * session's root in one transaction, and the replaced root is listed, so a
 * tab still on it is refused (`REPLACED_ROOT`) instead of wiping the history.
 * Under any other root the identity's rows are dropped, and a drop that
 * removed rows is reported until `acknowledgeDropped`. Every write checks in
 * its own transaction that the canary still opens under the scope's keys.
 *
 * Each conversation keeps a sealed read marker: the last row sequence it
 * accounted, the messages of other members since the last read on this
 * device, and the newest message time. Appending accounts the new records
 * without opening stored rows; rows stored after the marker, as after a
 * crash in between, are opened and accounted on the next call. History
 * stored before any marker counts as read.
 */
export class GroupMessageHistoryStore {
  private static readonly KEYS_LABEL = 'pigeon-group-history';
  /** How many stored rows a first marker opens to find the newest message. */
  private static readonly LATEST_LOOKBACK = 50;
  private static readonly READ_PURPOSE = 'read';
  private static readonly RECORD_PURPOSE = 'record';

  private readonly database: GroupMessageHistoryDatabase;
  private readonly dropped = new Set<string>();
  private queue: Promise<unknown> = Promise.resolve();
  private readonly scopes = new Map<string, GroupMessageHistoryScope>();

  public constructor(
    databaseName: string = scopeClientStorageKey('pigeon-group-history'),
  ) {
    this.database = new GroupMessageHistoryDatabase(databaseName);
  }

  private conversation(
    scope: GroupMessageHistoryScope,
    conversationId: string,
  ): GroupMessageHistoryConversation {
    const held = scope.conversations.get(conversationId);

    if (held) return held;
    const conversation = new GroupMessageHistoryConversation(
      scope.keys.tag(['conversation', conversationId]),
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
      const record = row ? this.openRow(scope, identityId, row) : undefined;

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
    const conversation = this.conversation(scope, conversationId);
    const row = await this.database.row(
      identityId,
      conversation.tag,
      scope.keys.tag(['record', conversationId, id]),
    );
    const [record] = this.opened(scope, identityId, row ? [row] : []);

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
      this.opened(
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
      ? scope.keys.open(
          GroupMessageHistoryStore.READ_PURPOSE,
          [conversation],
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
  private opened(
    scope: GroupMessageHistoryScope,
    identityId: string,
    rows: readonly GroupMessageHistoryRow[],
  ): DirectMessageRecord[] {
    return rows
      .map((row) => this.openRow(scope, identityId, row))
      .filter((record) => record !== undefined);
  }

  /** The record of one row; undefined when it does not open. */
  private openRow(
    scope: GroupMessageHistoryScope,
    identityId: string,
    row: GroupMessageHistoryRow,
  ): DirectMessageRecord | undefined {
    return this.recordOf(scope.keys, row);
  }

  /** The record of one row under `keys`; undefined when it does not open. */
  private recordOf(
    keys: DeviceRootRowKeys,
    row: GroupMessageHistoryRow,
  ): DirectMessageRecord | undefined {
    const plaintext = keys.open(
      GroupMessageHistoryStore.RECORD_PURPOSE,
      [row.conversation, row.record],
      row.sealed,
    );

    return plaintext
      ? (JSON.parse(new TextDecoder().decode(plaintext)) as DirectMessageRecord)
      : undefined;
  }

  /** Records what settling the canary record did, in counts only. */
  private report(identityId: string, settlement: Settlement): void {
    const { dropped = 0, resealed } = settlement;

    if (dropped > 0) this.dropped.add(identityId);

    if (resealed !== undefined) {
      // eslint-disable-next-line no-console
      console.debug('Group history re-sealed.', { dropped, resealed });
    }
  }

  /**
   * Re-seals rows and read markers that open under `roots.replaced` under
   * `roots.current`, with their tags under it. A row that does not open, or
   * does not read as a record, is left out.
   */
  private resealer(
    identityId: string,
    { current, replaced }: Roots,
  ): GroupMessageHistoryResealer {
    return {
      read: (from, to, sealed) => {
        const plaintext = replaced?.open(
          GroupMessageHistoryStore.READ_PURPOSE,
          [from],
          sealed,
        );

        return plaintext
          ? current.seal(GroupMessageHistoryStore.READ_PURPOSE, [to], plaintext)
          : undefined;
      },
      row: (row) => {
        try {
          const record = replaced ? this.recordOf(replaced, row) : undefined;

          return record ? this.sealed(current, identityId, record) : undefined;
        } catch {
          return undefined;
        }
      },
    };
  }

  /** The row keys of the session's root and of the root it replaced. */
  private roots(session: Session, root: SymmetricKey): Roots {
    const identityId = session.identity.id;
    const previous = session.previousDeviceSealedRootKey;
    const derive = (key: SymmetricKey): DeviceRootRowKeys =>
      DeviceRootRowKeys.derive(
        key,
        GroupMessageHistoryStore.KEYS_LABEL,
        identityId,
      );

    return {
      current: derive(root),
      generation: session.deviceSealedRootGeneration?.valueOf(),
      replaced: previous ? derive(previous) : undefined,
    };
  }

  /**
   * The identity's scope under the session's root, once its canary record
   * is settled for it; undefined without a root. Rejects with
   * `REPLACED_ROOT` for a root the record refuses.
   */
  private async scope(
    session: Session,
  ): Promise<GroupMessageHistoryScope | undefined> {
    const root = session.deviceSealedRootKey;

    if (!root) return undefined;
    const identityId = session.identity.id;
    const held = this.scopes.get(identityId);

    if (held?.opensUnder(root)) return held;
    const roots = this.roots(session, root);

    this.report(
      identityId,
      await this.database.settle(
        identityId,
        roots,
        this.resealer(identityId, roots),
      ),
    );
    const scope = new GroupMessageHistoryScope(root, roots.current);

    this.scopes.set(identityId, scope);

    return scope;
  }

  private sealed(
    keys: DeviceRootRowKeys,
    identityId: string,
    record: DirectMessageRecord,
  ): GroupMessageHistoryRow {
    const tags = {
      conversation: keys.tag(['conversation', record.conversationId]),
      record: keys.tag(['record', record.conversationId, record.id]),
    };

    return {
      ...tags,
      identityId,
      sealed: keys.seal(
        GroupMessageHistoryStore.RECORD_PURPOSE,
        [tags.conversation, tags.record],
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
      scope.keys.tag(['conversation', conversationId]);
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

    unknownRows.forEach((row, index) => {
      const record = row ? this.openRow(scope, identityId, row) : undefined;

      if (record) openedRecords.set(unknown[index], record);
    });
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
        scope.keys,
        tag,
        scope.keys.seal(
          GroupMessageHistoryStore.READ_PURPOSE,
          [tag],
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
          identityId,
          scope.keys,
          records.map((record) => this.sealed(scope.keys, identityId, record)),
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

  /** The author of sent message or poll `id`, if this device stored it. */
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

      return record?.type === DirectMailboxRecords.TYPE.sent ||
        record?.type === DirectMailboxRecords.TYPE.poll
        ? record.authorId
        : undefined;
    });
  }

  /**
   * Whether this device dropped the identity's stored group history because
   * it no longer opens under the device-sealed root, as after a device
   * revoke. Reports a drop until `acknowledgeDropped`. A deliberate `forget`
   * is not a drop. Never throws; a failure logs one line.
   */
  public checkDropped(session: Session): Promise<boolean> {
    return this.exclusive(async () => {
      try {
        await this.scope(session);
      } catch {
        // eslint-disable-next-line no-console
        console.debug('Group history check failed.');
      }

      return this.dropped.has(session.identity.id);
    });
  }

  /** Clears the identity's reported drop, once its notice is shown. */
  public acknowledgeDropped(identityId: string): void {
    this.dropped.delete(identityId);
  }

  /** Wipes one identity's history. Never throws; logs one line. */
  public forget(identityId: string): Promise<void> {
    return this.exclusive(async () => {
      this.scopes.delete(identityId);
      this.dropped.delete(identityId);

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
      const conversation = this.conversation(scope, conversationId);
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
