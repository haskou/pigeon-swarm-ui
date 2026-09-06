import { scopeClientWorkerUrl } from '../../../../shared/infrastructure/storage/ClientStorageScope';
import messageDecryptWorkerUrl from './messageDecryptWorker?worker&url';

export function createMessageDecryptWorker(): Worker {
  return new Worker(
    scopeClientWorkerUrl(new URL(messageDecryptWorkerUrl, import.meta.url)),
    {
      type: 'module',
    },
  );
}
