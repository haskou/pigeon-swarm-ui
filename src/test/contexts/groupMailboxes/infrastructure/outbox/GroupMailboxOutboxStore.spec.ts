import 'fake-indexeddb/auto';
import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { randomUUID } from 'node:crypto';

import type { GroupMailboxOutboxRow } from '../../../../../contexts/groupMailboxes/infrastructure/outbox/GroupMailboxOutboxRow';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { GroupMailboxOutboxStore } from '../../../../../contexts/groupMailboxes/infrastructure/outbox/GroupMailboxOutboxStore';

const marker = 'group-outbox-marker-31e0';
const session = {
  deviceSealedRootKey: SymmetricKey.fromBuffer(Buffer.alloc(32, 5)),
  identity: { id: 'alice' },
} as unknown as Session;
const row: GroupMailboxOutboxRow = {
  attempts: 0,
  body: marker,
  conversationId: `conversation-${marker}`,
  copies: [{ envelopeId: 'envelope', identityId: `bob-${marker}` }],
  createdAt: 1,
  generation: `generation-${marker}`,
  generationIndex: 0,
  id: 'row-1',
  landed: [{ epoch: '1', generation: marker, identityId: `carol-${marker}` }],
  record: marker,
  reference: `m-${marker}`,
  retryAt: 0,
};

describe(GroupMailboxOutboxStore.name, () => {
  it('replays a row sealed at rest', async () => {
    const name = `group-outbox-${randomUUID()}`;

    await new GroupMailboxOutboxStore(name).save(session, row);

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const stored = await new Promise<unknown[]>((resolve, reject) => {
      const request = db
        .transaction('entries', 'readonly')
        .objectStore('entries')
        .getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    db.close();
    expect(stored).toHaveLength(1);
    expect(
      Object.values(stored[0] as Record<string, unknown>)
        .map((value) =>
          value instanceof Uint8Array
            ? Buffer.from(value).toString('latin1')
            : String(value),
        )
        .join('|'),
    ).not.toContain(marker);
    expect(await new GroupMailboxOutboxStore(name).load(session)).toEqual([
      row,
    ]);
  });
});
