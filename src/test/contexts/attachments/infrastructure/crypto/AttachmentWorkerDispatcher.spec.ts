import type { WorkerResponse } from '../../../../../contexts/attachments/infrastructure/crypto/WorkerResponse';

import { AttachmentWorkerDispatcher } from '../../../../../contexts/attachments/infrastructure/crypto/AttachmentWorkerDispatcher';
import { AttachmentWorkerTerminatedError } from '../../../../../contexts/attachments/infrastructure/crypto/errors/AttachmentWorkerTerminatedError';

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
      }),
    ).rejects.toThrow('Attachment workers are not available');
  });

  it('terminates the worker and rejects pending requests on dispose', async () => {
    globalThis.Worker = {} as unknown as typeof Worker;
    const worker = {
      onerror: null,
      onmessage: null,
      postMessage: jest.fn(),
      terminate: jest.fn(),
    } as unknown as Worker;
    const dispatcher = new AttachmentWorkerDispatcher(() => worker);
    const pending = dispatcher.run({
      file: new File(['content'], 'file.txt'),
      id: 'ignored',
      type: 'encrypt',
    });
    const rejection = expect(pending).rejects.toBeInstanceOf(
      AttachmentWorkerTerminatedError,
    );

    dispatcher.dispose();

    await rejection;
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('starts a fresh worker for requests made after dispose', () => {
    globalThis.Worker = {} as unknown as typeof Worker;
    const createWorker = jest.fn(
      () =>
        ({
          onerror: null,
          onmessage: null,
          postMessage: jest.fn(),
          terminate: jest.fn(),
        }) as unknown as Worker,
    );
    const dispatcher = new AttachmentWorkerDispatcher(createWorker);
    const request = {
      file: new File(['content'], 'file.txt'),
      id: 'ignored',
      type: 'encrypt' as const,
    };

    dispatcher.run(request).catch(() => undefined);
    dispatcher.dispose();
    dispatcher.run(request).catch(() => undefined);

    expect(createWorker).toHaveBeenCalledTimes(2);
  });
});
