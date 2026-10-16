import 'fake-indexeddb/auto';
import { randomUUID } from 'node:crypto';

import {
  indexedDbRequest,
  indexedDbTransaction,
} from '../../../../shared/infrastructure/storage/indexedDbRequest';

function openDatabase(): Promise<IDBDatabase> {
  const opening = indexedDB.open(`indexed-db-request-${randomUUID()}`, 1);

  opening.addEventListener('upgradeneeded', () => {
    opening.result.createObjectStore('rows');
  });

  return indexedDbRequest(opening);
}

describe(indexedDbTransaction.name, () => {
  it('resolves when the transaction commits', async () => {
    const database = await openDatabase();
    const transaction = database.transaction('rows', 'readwrite');

    transaction.objectStore('rows').put('value', 'key');

    await expect(indexedDbTransaction(transaction)).resolves.toBeUndefined();
  });

  it('rejects with an error when the transaction is aborted explicitly', async () => {
    const database = await openDatabase();
    const transaction = database.transaction('rows', 'readwrite');
    const committed = indexedDbTransaction(transaction);

    transaction.abort();

    await expect(committed).rejects.toThrow('IndexedDB transaction aborted.');
  });
});
