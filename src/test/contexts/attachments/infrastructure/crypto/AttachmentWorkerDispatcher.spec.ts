import type { WorkerResponse } from '../../../../../contexts/attachments/infrastructure/crypto/WorkerResponse';

import { AttachmentWorkerDispatcher } from '../../../../../contexts/attachments/infrastructure/crypto/AttachmentWorkerDispatcher';

describe(AttachmentWorkerDispatcher.name, () => {
  const originalWorker = globalThis.Worker;

  afterEach(() => {
    globalThis.Worker = originalWorker;
  });

  it('resolves completed worker requests', async () => {
    globalThis.Worker = class {} as unknown as typeof Worker;
    const worker = {
      onerror: null,
      onmessage: null,
      postMessage: jest.fn(),
      terminate: jest.fn(),
    } as unknown as Worker;
    const dispatcher = new AttachmentWorkerDispatcher(() => worker);
    const pending = dispatcher.run<
      Extract<WorkerResponse, { type: 'decrypt-result' }>
    >({
      attachment: {
        cid: 'cid',
        contentType: 'text/plain',
        filename: 'file.txt',
        size: 1,
      },
      encryptedBytes: new ArrayBuffer(0),
      id: 'ignored',
      type: 'decrypt',
    });
    const sent = (worker.postMessage as jest.Mock).mock.calls[0][0] as {
      id: string;
    };

    worker.onmessage?.(
      new MessageEvent<WorkerResponse>('message', {
        data: {
          bytes: new ArrayBuffer(0),
          id: sent.id,
          type: 'decrypt-result',
        },
      }),
    );

    await expect(pending).resolves.toEqual(
      expect.objectContaining({ id: sent.id, type: 'decrypt-result' }),
    );
  });

  it('rejects requests when workers are unavailable', async () => {
    globalThis.Worker = undefined as unknown as typeof Worker;

    await expect(
      new AttachmentWorkerDispatcher().run({
        file: new File(['content'], 'file.txt'),
        id: 'request',
        type: 'encrypt',
        uploadFilename: 'upload.bin',
      }),
    ).rejects.toThrow('Attachment workers are not available');
  });
});
