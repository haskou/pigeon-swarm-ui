import type { AttachmentProgress } from '../../../shared/domain/pigeonResources.types';

import { AttachmentCipher } from './attachmentCipher';

const cipher = new AttachmentCipher();
const workerScope = self as unknown as {
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

self.onmessage = async (
  event: MessageEvent<
    | {
        file: File;
        id: string;
        type: 'encrypt';
      }
    | {
        attachment: Parameters<AttachmentCipher['decryptWithoutWorker']>[0];
        encryptedBytes: ArrayBuffer;
        id: string;
        type: 'decrypt';
      }
  >,
) => {
  const request = event.data;
  const progress = (nextProgress: AttachmentProgress) => {
    workerScope.postMessage({
      id: request.id,
      progress: nextProgress,
      type: 'progress',
    });
  };

  try {
    if (request.type === 'encrypt') {
      const result = await cipher.encryptWithoutWorker(request.file, progress);
      const response = { ...result, id: request.id };

      workerScope.postMessage(response, [response.encryptedBytes]);

      return;
    }

    const result = cipher.decryptWithoutWorker(
      request.attachment,
      request.encryptedBytes,
      progress,
    );
    const response = { ...result, id: request.id };

    workerScope.postMessage(response, [response.bytes]);
  } catch (caught) {
    workerScope.postMessage({
      error: caught instanceof Error ? caught.message : 'Attachment failed',
      id: request.id,
      type: 'error',
    });
  }
};
