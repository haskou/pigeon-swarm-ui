import type {
  MessageAttachmentEncryption,
  PendingMessageAttachment,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';

import { AttachmentCipher } from '../crypto/AttachmentCipher';
import { PigeonFilesApi } from './PigeonFilesApi';

function attachmentEncryption(): MessageAttachmentEncryption {
  return {
    algorithm: 'AES-GCM',
    chunks: [{ iv: 'iv', size: 3 }],
    chunkSize: 8,
    iv: 'iv',
    key: 'key',
  };
}

function httpClient({ request }: { request: jest.Mock }): HttpJsonClient {
  return {
    request,
    requestBlob: jest.fn(),
  } as unknown as HttpJsonClient;
}

function signer({ headers }: { headers: jest.Mock }): RequestSigner {
  return { headers } as unknown as RequestSigner;
}

describe(PigeonFilesApi.name, () => {
  const session = { identity: { id: 'identity-1' } } as Session;

  it('publishes small attachments publicly when small encryption is disabled', async () => {
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    const request = jest.fn().mockResolvedValue({
      cid: 'public-cid',
      contentType: 'text/plain',
      filename: 'hello.txt',
      size: file.size,
    });
    const signerHeaders = jest
      .fn()
      .mockResolvedValue({ 'X-Test-Signature': 'signature' });
    const cipher = { encrypt: jest.fn() } as unknown as AttachmentCipher;
    const api = new PigeonFilesApi(
      httpClient({ request }),
      signer({ headers: signerHeaders }),
      cipher,
    );
    const progress = jest.fn();

    await expect(
      api.publishMessageAttachments(session, [file], progress, {
        encryptSmallAttachments: false,
      }),
    ).resolves.toEqual([
      {
        cid: 'public-cid',
        contentType: 'text/plain',
        encrypted: false,
        filename: 'hello.txt',
        size: file.size,
        storage: 'public',
      },
    ]);

    expect(cipher.encrypt).not.toHaveBeenCalled();
    expect(signerHeaders).toHaveBeenCalledWith(
      session,
      'POST',
      '/ipfs/public',
      expect.any(ArrayBuffer),
    );
    expect(request).toHaveBeenCalledWith(
      '/ipfs/public',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'text/plain',
          'X-Filename': 'hello.txt',
          'X-Test-Signature': 'signature',
        }),
        method: 'POST',
      }),
    );
    expect(progress).toHaveBeenCalledWith({
      filename: 'hello.txt',
      percent: 0,
      phase: 'upload',
    });
    expect(progress).toHaveBeenCalledWith({
      filename: 'hello.txt',
      percent: 100,
      phase: 'upload',
    });
  });

  it('keeps small attachments encrypted by default', async () => {
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    const encryption = attachmentEncryption();
    const pending: PendingMessageAttachment = {
      encryptedBytes: new Uint8Array([1, 2, 3]).buffer,
      metadata: {
        contentType: 'text/plain',
        encryption,
        filename: 'hello.txt',
        size: file.size,
      },
      uploadFilename: 'encrypted.bin',
    };
    const request = jest.fn().mockResolvedValue({
      cid: 'private-cid',
      contentType: 'application/octet-stream',
      encrypted: true,
      filename: 'encrypted.bin',
      size: pending.encryptedBytes.byteLength,
    });
    const signerHeaders = jest
      .fn()
      .mockResolvedValue({ 'X-Test-Signature': 'signature' });
    const cipher = {
      encrypt: jest.fn().mockResolvedValue(pending),
    } as unknown as AttachmentCipher;
    const api = new PigeonFilesApi(
      httpClient({ request }),
      signer({ headers: signerHeaders }),
      cipher,
    );

    await expect(
      api.publishMessageAttachments(session, [file]),
    ).resolves.toEqual([
      {
        ...pending.metadata,
        cid: 'private-cid',
        encrypted: true,
        encryptedSize: pending.encryptedBytes.byteLength,
      },
    ]);

    expect(cipher.encrypt).toHaveBeenCalledWith(file, undefined);
    expect(signerHeaders).toHaveBeenCalledWith(
      session,
      'POST',
      '/ipfs/private',
      pending.encryptedBytes,
    );
    expect(request).toHaveBeenCalledWith(
      '/ipfs/private',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/octet-stream',
          'X-Filename': 'encrypted.bin',
          'X-Test-Signature': 'signature',
        }),
        method: 'POST',
      }),
    );
  });
});
