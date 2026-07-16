import type { PendingMessageAttachment } from '../../../../../contexts/attachments/infrastructure/crypto/resources/PendingMessageAttachment';
import type {
  MessageAttachmentEncryption,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { AttachmentNetworkId } from '../../../../../contexts/attachments/domain/value-objects/AttachmentNetworkId';
import { AttachmentCipher } from '../../../../../contexts/attachments/infrastructure/crypto/AttachmentCipher';
import { PigeonAttachmentBlobUploader } from '../../../../../contexts/attachments/infrastructure/http/PigeonAttachmentBlobUploader';
import { PigeonAttachmentPreviewCreator } from '../../../../../contexts/attachments/infrastructure/http/PigeonAttachmentPreviewCreator';
import { PigeonChunkedAttachmentUploader } from '../../../../../contexts/attachments/infrastructure/http/PigeonChunkedAttachmentUploader';
import { PigeonDirectAttachmentUploader } from '../../../../../contexts/attachments/infrastructure/http/PigeonDirectAttachmentUploader';
import { PigeonMessageAttachmentUploader } from '../../../../../contexts/attachments/infrastructure/http/PigeonMessageAttachmentUploader';
import { PigeonPrivateFilesClient } from '../../../../../contexts/attachments/infrastructure/http/PigeonPrivateFilesClient';
import { PigeonPublicFilesClient } from '../../../../../contexts/attachments/infrastructure/http/PigeonPublicFilesClient';
import { MessageAttachmentThumbnailPreparer } from '../../../../../contexts/attachments/infrastructure/media/MessageAttachmentThumbnailPreparer';
import { PublicImageUploadPreparer } from '../../../../../contexts/attachments/infrastructure/media/PublicImageUploadPreparer';

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

function messageUploader(
  http: HttpJsonClient,
  requestSigner: RequestSigner,
  cipher: AttachmentCipher,
  publicImages: Pick<
    PublicImageUploadPreparer,
    'prepare'
  > = new PublicImageUploadPreparer(),
  thumbnails: Pick<
    MessageAttachmentThumbnailPreparer,
    'prepare'
  > = new MessageAttachmentThumbnailPreparer(),
): PigeonMessageAttachmentUploader {
  const privateFiles = new PigeonPrivateFilesClient(http, requestSigner);
  const publicFiles = new PigeonPublicFilesClient(http, requestSigner);
  const blobs = new PigeonAttachmentBlobUploader(
    new PigeonDirectAttachmentUploader(privateFiles, publicFiles),
    new PigeonChunkedAttachmentUploader(privateFiles, publicFiles),
  );

  return new PigeonMessageAttachmentUploader(
    cipher,
    blobs,
    publicImages,
    new PigeonAttachmentPreviewCreator(cipher, blobs, thumbnails),
  );
}

describe(PigeonMessageAttachmentUploader.name, () => {
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
    const uploader = messageUploader(
      httpClient({ request }),
      signer({ headers: signerHeaders }),
      cipher,
    );
    const progress = jest.fn();

    await expect(
      uploader.publishPublic(session, file, progress),
    ).resolves.toEqual({
      cid: 'public-cid',
      contentType: 'text/plain',
      encrypted: false,
      filename: 'hello.txt',
      size: file.size,
      storage: 'public',
    });

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

  it('converts public image attachments before uploading them', async () => {
    const sourceFile = new File(['png'], 'photo.png', { type: 'image/png' });
    const webpFile = new File(['webp'], 'photo.webp', { type: 'image/webp' });
    const request = jest.fn().mockResolvedValue({
      cid: 'public-cid',
      contentType: 'image/webp',
      filename: 'photo.webp',
      size: webpFile.size,
    });
    const signerHeaders = jest
      .fn()
      .mockResolvedValue({ 'X-Test-Signature': 'signature' });
    const cipher = { encrypt: jest.fn() } as unknown as AttachmentCipher;
    const publicImageUploadPreparer = {
      prepare: jest.fn().mockResolvedValue(webpFile),
    };
    const uploader = messageUploader(
      httpClient({ request }),
      signer({ headers: signerHeaders }),
      cipher,
      publicImageUploadPreparer,
    );

    await expect(uploader.publishPublic(session, sourceFile)).resolves.toEqual({
      cid: 'public-cid',
      contentType: 'image/webp',
      encrypted: false,
      filename: 'photo.webp',
      size: webpFile.size,
      storage: 'public',
    });

    expect(publicImageUploadPreparer.prepare).toHaveBeenCalledWith(sourceFile);
    expect(cipher.encrypt).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith(
      '/ipfs/public',
      expect.objectContaining({
        body: expect.any(ArrayBuffer),
        headers: expect.objectContaining({
          'Content-Type': 'image/webp',
          'X-Filename': 'photo.webp',
          'X-Test-Signature': 'signature',
        }),
        method: 'POST',
      }),
    );
  });

  it('adds a public WebP thumbnail for large public image attachments', async () => {
    const sourceFile = new File([new Uint8Array(200 * 1024)], 'photo.png', {
      type: 'image/png',
    });
    const webpFile = new File([new Uint8Array(180 * 1024)], 'photo.webp', {
      type: 'image/webp',
    });
    const thumbnailFile = new File(['thumb'], 'photo.thumbnail.webp', {
      type: 'image/webp',
    });
    const request = jest.fn().mockImplementation((_path, options) => {
      const filename = options.headers['X-Filename'];

      return Promise.resolve({
        cid: filename === 'photo.thumbnail.webp' ? 'preview-cid' : 'public-cid',
        contentType: 'image/webp',
        filename,
        size:
          filename === 'photo.thumbnail.webp'
            ? thumbnailFile.size
            : webpFile.size,
      });
    });
    const signerHeaders = jest
      .fn()
      .mockResolvedValue({ 'X-Test-Signature': 'signature' });
    const cipher = { encrypt: jest.fn() } as unknown as AttachmentCipher;
    const publicImageUploadPreparer = {
      prepare: jest.fn().mockResolvedValue(webpFile),
    };
    const thumbnailPreparer = {
      prepare: jest.fn().mockResolvedValue(thumbnailFile),
    };
    const uploader = messageUploader(
      httpClient({ request }),
      signer({ headers: signerHeaders }),
      cipher,
      publicImageUploadPreparer,
      thumbnailPreparer,
    );

    await expect(uploader.publishPublic(session, sourceFile)).resolves.toEqual({
      cid: 'public-cid',
      contentType: 'image/webp',
      encrypted: false,
      filename: 'photo.webp',
      preview: {
        cid: 'preview-cid',
        contentType: 'image/webp',
        encrypted: false,
        filename: 'photo.thumbnail.webp',
        size: thumbnailFile.size,
        storage: 'public',
      },
      size: webpFile.size,
      storage: 'public',
    });

    expect(thumbnailPreparer.prepare).toHaveBeenCalledWith(sourceFile);
    expect(thumbnailPreparer.prepare).not.toHaveBeenCalledWith(webpFile);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('keeps public animated gif previews based on the original file', async () => {
    const sourceFile = new File([new Uint8Array(200 * 1024)], 'dance.gif', {
      type: 'image/gif',
    });
    const webpFile = new File([new Uint8Array(180 * 1024)], 'dance.webp', {
      type: 'image/webp',
    });
    const thumbnailFile = new File(['animated-thumb'], 'dance.thumbnail.webp', {
      type: 'image/webp',
    });
    const request = jest.fn().mockImplementation((_path, options) => {
      const filename = options.headers['X-Filename'];

      return Promise.resolve({
        cid:
          filename === 'dance.thumbnail.webp'
            ? 'animated-preview-cid'
            : 'public-cid',
        contentType: 'image/webp',
        filename,
        size:
          filename === 'dance.thumbnail.webp'
            ? thumbnailFile.size
            : webpFile.size,
      });
    });
    const signerHeaders = jest
      .fn()
      .mockResolvedValue({ 'X-Test-Signature': 'signature' });
    const cipher = { encrypt: jest.fn() } as unknown as AttachmentCipher;
    const publicImageUploadPreparer = {
      prepare: jest.fn().mockResolvedValue(webpFile),
    };
    const thumbnailPreparer = {
      prepare: jest.fn().mockResolvedValue(thumbnailFile),
    };
    const uploader = messageUploader(
      httpClient({ request }),
      signer({ headers: signerHeaders }),
      cipher,
      publicImageUploadPreparer,
      thumbnailPreparer,
    );

    await expect(uploader.publishPublic(session, sourceFile)).resolves.toEqual({
      cid: 'public-cid',
      contentType: 'image/webp',
      encrypted: false,
      filename: 'dance.webp',
      preview: {
        cid: 'animated-preview-cid',
        contentType: 'image/webp',
        encrypted: false,
        filename: 'dance.thumbnail.webp',
        size: thumbnailFile.size,
        storage: 'public',
      },
      size: webpFile.size,
      storage: 'public',
    });

    expect(publicImageUploadPreparer.prepare).toHaveBeenCalledWith(sourceFile);
    expect(thumbnailPreparer.prepare).toHaveBeenCalledWith(sourceFile);
    expect(thumbnailPreparer.prepare).not.toHaveBeenCalledWith(webpFile);
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
    const uploader = messageUploader(
      httpClient({ request }),
      signer({ headers: signerHeaders }),
      cipher,
    );

    await expect(
      uploader.publishEncrypted(
        session,
        file,
        AttachmentNetworkId.fromString('network-1'),
      ),
    ).resolves.toEqual({
      ...pending.metadata,
      cid: 'private-cid',
      encrypted: true,
      encryptedSize: pending.encryptedBytes.byteLength,
    });

    expect(cipher.encrypt).toHaveBeenCalledWith(file, undefined);
    expect(signerHeaders).toHaveBeenCalledWith(
      session,
      'POST',
      '/ipfs/network-1',
      pending.encryptedBytes,
    );
    expect(request).toHaveBeenCalledWith(
      '/ipfs/network-1',
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

  it('keeps thumbnails private when the original image is encrypted', async () => {
    const file = new File([new Uint8Array(200 * 1024)], 'secret.png', {
      type: 'image/png',
    });
    const thumbnailFile = new File(['thumb'], 'secret.thumbnail.webp', {
      type: 'image/webp',
    });
    const originalEncryption = attachmentEncryption();
    const thumbnailEncryption = {
      ...attachmentEncryption(),
      key: 'thumbnail-key',
    };
    const pendingOriginal: PendingMessageAttachment = {
      encryptedBytes: new Uint8Array([1, 2, 3]).buffer,
      metadata: {
        contentType: 'image/png',
        encryption: originalEncryption,
        filename: 'secret.png',
        size: file.size,
      },
      uploadFilename: 'original.bin',
    };
    const pendingThumbnail: PendingMessageAttachment = {
      encryptedBytes: new Uint8Array([4, 5, 6]).buffer,
      metadata: {
        contentType: 'image/webp',
        encryption: thumbnailEncryption,
        filename: 'secret.thumbnail.webp',
        size: thumbnailFile.size,
      },
      uploadFilename: 'thumbnail.bin',
    };
    const request = jest.fn().mockImplementation((_path, options) => {
      const filename = options.headers['X-Filename'];
      let cid = 'private-cid';

      if (filename === 'thumbnail.bin') cid = 'private-preview-cid';

      return Promise.resolve({
        cid,
        contentType: 'application/octet-stream',
        encrypted: true,
        filename,
        size:
          filename === 'thumbnail.bin'
            ? pendingThumbnail.encryptedBytes.byteLength
            : pendingOriginal.encryptedBytes.byteLength,
      });
    });
    const signerHeaders = jest
      .fn()
      .mockResolvedValue({ 'X-Test-Signature': 'signature' });
    const cipher = {
      encrypt: jest.fn((input: File) =>
        Promise.resolve(
          input === thumbnailFile ? pendingThumbnail : pendingOriginal,
        ),
      ),
    } as unknown as AttachmentCipher;
    const thumbnailPreparer = {
      prepare: jest.fn().mockResolvedValue(thumbnailFile),
    };
    const uploader = messageUploader(
      httpClient({ request }),
      signer({ headers: signerHeaders }),
      cipher,
      undefined,
      thumbnailPreparer,
    );

    await expect(
      uploader.publishEncrypted(
        session,
        file,
        AttachmentNetworkId.fromString('network-1'),
      ),
    ).resolves.toEqual({
      ...pendingOriginal.metadata,
      cid: 'private-cid',
      encrypted: true,
      encryptedSize: pendingOriginal.encryptedBytes.byteLength,
      preview: {
        ...pendingThumbnail.metadata,
        cid: 'private-preview-cid',
        encrypted: true,
        encryptedSize: pendingThumbnail.encryptedBytes.byteLength,
      },
    });

    expect(thumbnailPreparer.prepare).toHaveBeenCalledWith(file);
    expect(cipher.encrypt).toHaveBeenCalledWith(thumbnailFile);
    expect(cipher.encrypt).toHaveBeenCalledWith(file, undefined);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
