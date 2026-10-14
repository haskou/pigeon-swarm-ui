import type { Session } from '../../../identities/infrastructure/session/Session';
import type { DirectMessageRecord } from '../../../mailboxes/domain/DirectMessageRecord';
import type { GroupMessageHistoryRow } from './GroupMessageHistoryRow';

import { scopeClientStorageKey } from '../../../../shared/infrastructure/storage/ClientStorageScope';
import { DirectMailboxRecords } from '../../../mailboxes/domain/DirectMailboxRecords';
import { DeviceRootRowKeys } from '../../../messages/infrastructure/mailbox/DeviceRootRowKeys';
import { GroupMessageHistoryConversation } from './GroupMessageHistoryConversation';
import { GroupMessageHistoryDatabase } from './GroupMessageHistoryDatabase';
import { GroupMessageHistoryScope } from './GroupMessageHistoryScope';

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
 */
export class GroupMessageHistoryStore {
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

  /** The records of the rows that open under this scope, in row order. */
  private async opened(
    scope: GroupMessageHistoryScope,
    identityId: string,
    rows: readonly GroupMessageHistoryRow[],
  ): Promise<DirectMessageRecord[]> {
    const plaintexts = await Promise.all(
      rows.map((row) =>
        scope.keys.cipher.open(
          GroupMessageHistoryStore.aad(identityId, row),
          row.sealed,
        ),
      ),
    );

    return plaintexts
      .filter((plaintext) => plaintext !== undefined)
      .map(
        (plaintext) =>
          JSON.parse(
            new TextDecoder().decode(plaintext),
          ) as DirectMessageRecord,
      );
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

  /** Stores the records, once per id. Rejects on failure. */
  public append(
    session: Session,
    records: readonly DirectMessageRecord[],
  ): Promise<void> {
    return this.exclusive(async () => {
      const scope = await this.scope(session);

      if (!scope || records.length === 0) return;
      const identityId = session.identity.id;

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
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.debug('Group history save failed.', { count: records.length });

        throw error;
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
}
