import { AttachmentCipher } from '../../../../../contexts/attachments/infrastructure/crypto/AttachmentCipher';
import { AttachmentWorkerTerminatedError } from '../../../../../contexts/attachments/infrastructure/crypto/errors/AttachmentWorkerTerminatedError';

describe(AttachmentCipher.name, () => {
  it('converts base64 values to exact array buffers', () => {
    const cipher = AttachmentCipher.inCurrentThread();
    const bytes = new Uint8Array(cipher.base64ToArrayBuffer('AQID'));

    expect([...bytes]).toEqual([1, 2, 3]);
  });

  it('encrypts and decrypts attachment bytes', async () => {
    const cipher = AttachmentCipher.inCurrentThread();
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    const encrypted = await cipher.encrypt(file);
    const blob = await cipher.decrypt(
      {
        ...encrypted.metadata,
        cid: 'cid',
        encryptedSize: encrypted.encryptedBytes.byteLength,
      },
      encrypted.encryptedBytes,
    );

    await expect(blob.text()).resolves.toBe('hello');
    expect(encrypted.metadata.encryption?.chunks?.length).toBeGreaterThan(0);
  });

  describe('when the worker is disposed mid-request', () => {
    const originalWorker = globalThis.Worker;

    beforeEach(() => {
      globalThis.Worker = class {} as unknown as typeof Worker;
    });

    afterEach(() => {
      globalThis.Worker = originalWorker;
    });

    function silentWorker(): Worker {
      return {
        onerror: null,
        onmessage: null,
        postMessage: jest.fn(),
        terminate: jest.fn(),
      } as unknown as Worker;
    }

    it('rejects encryption instead of running it on the main thread', async () => {
      const cipher = AttachmentCipher.withWorker(silentWorker);
      const encrypting = cipher.encrypt(
        new File(['hello'], 'hello.txt', { type: 'text/plain' }),
      );
      const rejection = expect(encrypting).rejects.toBeInstanceOf(
        AttachmentWorkerTerminatedError,
      );

      cipher.dispose();

      await rejection;
    });

    it('rejects decryption instead of running it on the main thread', async () => {
      const cipher = AttachmentCipher.withWorker(silentWorker);
      const decrypting = cipher.decrypt(
        {
          cid: 'cid',
          contentType: 'text/plain',
          encryptedSize: 0,
          filename: 'hello.txt',
          size: 0,
        },
        new ArrayBuffer(0),
      );
      const rejection = expect(decrypting).rejects.toBeInstanceOf(
        AttachmentWorkerTerminatedError,
      );

      cipher.dispose();

      await rejection;
    });
  });
});
