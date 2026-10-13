import { UUID } from '@haskou/value-objects';

import type { Session } from '../../../identities/infrastructure/session/Session';
import type { DirectMessageRecord } from '../../../mailboxes/domain/DirectMessageRecord';
import type { GroupMessageHistoryRow } from './GroupMessageHistoryRow';

import { scopeClientStorageKey } from '../../../../shared/infrastructure/storage/ClientStorageScope';
import { DeviceSealedRowStore } from '../../../messages/infrastructure/mailbox/DeviceSealedRowStore';

/**
 * The accepted records of this identity's group conversations, sealed under
 * the device-sealed root. Rows are keyed by random ids, so neither a
 * conversation nor a record id is readable at rest. A record stored twice,
 * as after a crash before its page was acknowledged, loads once. Without a
 * device-sealed root the store keeps nothing.
 */
export class GroupMessageHistoryStore {
  private readonly rows: DeviceSealedRowStore<GroupMessageHistoryRow>;

  public constructor(
    databaseName: string = scopeClientStorageKey('pigeon-group-history'),
  ) {
    this.rows = new DeviceSealedRowStore(
      databaseName,
      'pigeon-group-history',
      'Group history',
    );
  }

  public async append(
    session: Session,
    records: readonly DirectMessageRecord[],
  ): Promise<void> {
    for (const record of records) {
      await this.rows.save(session, {
        id: UUID.generate().toString(),
        record,
      });
    }
  }

  public async forget(identityId: string): Promise<void> {
    await this.rows.forget(identityId);
  }

  /** One conversation's records, once each, oldest first. */
  public async load(
    session: Session,
    conversationId: string,
  ): Promise<DirectMessageRecord[]> {
    const records = new Map<string, DirectMessageRecord>();

    for (const { record } of await this.rows.load(session)) {
      if (record.conversationId === conversationId && !records.has(record.id)) {
        records.set(record.id, record);
      }
    }

    return [...records.values()].sort(
      (left, right) => left.createdAt - right.createdAt,
    );
  }
}
