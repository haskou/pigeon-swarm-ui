import type { DirectMessageOutboxRow as Row } from './DirectMessageOutboxRow';

import { scopeClientStorageKey } from '../../../../shared/infrastructure/storage/ClientStorageScope';
import { DeviceSealedRowStore } from './DeviceSealedRowStore';

/**
 * One-to-one sends that are not yet delivered to both inboxes. Each row is
 * sealed under the device-sealed root, so no payload or peer id is readable
 * at rest. Without a device-sealed root the store keeps nothing; sends then
 * live in memory only.
 */
export class DirectMessageOutboxStore extends DeviceSealedRowStore<Row> {
  public constructor(
    databaseName: string = scopeClientStorageKey('pigeon-direct-outbox'),
  ) {
    super(databaseName, 'pigeon-direct-outbox', 'Direct outbox');
  }
}
