import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

import { IndexedDbMlsStateStore } from '../../../../contexts/communities/infrastructure/mls/IndexedDbMlsStateStore';
import { IndexedDbGroupMailboxGenerationStore } from '../../../../contexts/groupMailboxes/infrastructure/indexeddb/IndexedDbGroupMailboxGenerationStore';
import { DeviceSealedEntryStore } from '../../../../contexts/messages/infrastructure/mailbox/DeviceSealedEntryStore';

/**
 * The MLS state and generation stores of one identity on one test device,
 * sealed under a fixed device-sealed root, in `<databaseName>-mls` and
 * `<databaseName>-generations`.
 */
export function sealedGroupStores(
  databaseName: string,
  identityId: string,
): {
  generations: IndexedDbGroupMailboxGenerationStore;
  state: IndexedDbMlsStateStore;
} {
  const session = (): Session =>
    ({
      deviceSealedRootKey: SymmetricKey.fromBuffer(Buffer.alloc(32, 7)),
      identity: { id: identityId },
    }) as unknown as Session;

  return {
    generations: new IndexedDbGroupMailboxGenerationStore(
      new DeviceSealedEntryStore(
        `${databaseName}-generations`,
        'pigeon-group-generations',
      ),
      session,
    ),
    state: new IndexedDbMlsStateStore(
      new DeviceSealedEntryStore(`${databaseName}-mls`, 'pigeon-group-mls'),
      session,
    ),
  };
}
