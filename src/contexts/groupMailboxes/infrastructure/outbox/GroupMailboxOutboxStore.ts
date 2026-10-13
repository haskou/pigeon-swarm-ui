import type { GroupMailboxOutboxRow as Row } from './GroupMailboxOutboxRow';

import { scopeClientStorageKey } from '../../../../shared/infrastructure/storage/ClientStorageScope';
import { DeviceSealedRowStore } from '../../../messages/infrastructure/mailbox/DeviceSealedRowStore';

/**
 * Group records not yet appended to every recipient's inbox, sealed under the
 * device-sealed root: no payload, commit or member id is readable at rest.
 * Without a device-sealed root the store keeps nothing; the records then
 * live in memory only.
 */
export class GroupMailboxOutboxStore extends DeviceSealedRowStore<Row> {
  public constructor(
    databaseName: string = scopeClientStorageKey('pigeon-group-outbox'),
  ) {
    super(databaseName, 'pigeon-group-outbox', 'Group outbox');
  }
}
