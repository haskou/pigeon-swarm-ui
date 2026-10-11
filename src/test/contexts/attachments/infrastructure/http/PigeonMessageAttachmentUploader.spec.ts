import type { PendingMessageAttachment } from '../../../../../contexts/attachments/infrastructure/crypto/resources/PendingMessageAttachment';
import type {
  MessageAttachmentEncryption,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { AttachmentCipher } from '../../../../../contexts/attachments/infrastructure/crypto/AttachmentCipher';
import { PigeonAttachmentBlobUploader } from '../../../../../contexts/attachments/infrastructure/http/PigeonAttachmentBlobUploader';
import { PigeonAttachmentPreviewCreator } from '../../../../../contexts/attachments/infrastructure/http/PigeonAttachmentPreviewCreator';
import { PigeonChunkedAttachmentUploader } from '../../../../../contexts/attachments/infrastructure/http/PigeonChunkedAttachmentUploader';
import { PigeonDirectAttachmentUploader } from '../../../../../contexts/attachments/infrastructure/http/PigeonDirectAttachmentUploader';
import { PigeonMessageAttachmentUploader } from '../../../../../contexts/attachments/infrastructure/http/PigeonMessageAttachmentUploader';
import { PigeonPrivateBlobClient } from '../../../../../contexts/attachments/infrastructure/http/PigeonPrivateBlobClient';
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
  const privateBlobs = new PigeonPrivateBlobClient(http, requestSigner);
  const publicFiles = new PigeonPublicFilesClient(http, requestSigner, {
    register: jest.fn(),
  });
  const blobs = new PigeonAttachmentBlobUploader(
    new PigeonDirectAttachmentUploader(privateBlobs, publicFiles),
    new PigeonChunkedAttachmentUploader(privateBlobs, publicFiles),
  );

  return new PigeonMessageAttachmentUploader(
    cipher,
    blobs,
    publicImages,
    new PigeonAttachmentPreviewCreator(cipher, blobs, thumbnails),
  );
}

describe(PigeonMessageAttachmentUploader.name, () => {
  const session = {
    identity: { id: 'identity-1', networks: [] },
  } as unknown as Session;

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

  it('keeps small attachments encrypted in a private blob', async () => {
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    const pending: PendingMessageAttachment = {
      encryptedBytes: new Uint8Array([1, 2, 3]).buffer,
      metadata: {
        contentType: 'text/plain',
        encryption: attachmentEncryption(),
        filename: 'hello.txt',
        size: file.size,
      },
    };
    const request = jest
      .fn()
      .mockResolvedValueOnce({
        blobId: 'blob-1',
        downloadToken: 'download-token-1234567890',
        expiresAt: 1,
        uploadToken: 'upload-token-1234567890',
      })
      .mockResolvedValueOnce(undefined);
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

    await expect(uploader.publishEncrypted(session, file)).resolves.toEqual({
      ...pending.metadata,
      blobs: [
        {
          blobId: 'blob-1',
          downloadToken: 'download-token-1234567890',
          expiresAt: 1,
          index: 0,
          size: 3,
        },
      ],
      encrypted: true,
      encryptedSize: 3,
    });

    expect(cipher.encrypt).toHaveBeenCalledWith(file, undefined);
    expect(signerHeaders).toHaveBeenCalledWith(
      session,
      'POST',
      '/private-blobs',
      {
        size: 3,
      },
    );
    expect(request).toHaveBeenNthCalledWith(
      1,
      '/private-blobs',
      expect.objectContaining({
        body: JSON.stringify({ size: 3 }),
        method: 'POST',
      }),
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      '/private-blobs/blob-1',
      expect.objectContaining({
        body: pending.encryptedBytes,
        headers: {
          Authorization: 'Bearer upload-token-1234567890',
          'Content-Type': 'application/octet-stream',
        },
        method: 'PUT',
      }),
    );
  });

  it('keeps thumbnails in private blobs when the original image is encrypted', async () => {
    const file = new File([new Uint8Array(200 * 1024)], 'secret.png', {
      type: 'image/png',
    });
    const thumbnailFile = new File(['thumb'], 'secret.thumbnail.webp', {
      type: 'image/webp',
    });
    const pendingOriginal: PendingMessageAttachment = {
      encryptedBytes: new Uint8Array([1, 2, 3]).buffer,
      metadata: {
        contentType: 'image/png',
        encryption: attachmentEncryption(),
        filename: 'secret.png',
        size: file.size,
      },
    };
    const pendingThumbnail: PendingMessageAttachment = {
      encryptedBytes: new Uint8Array([4, 5, 6]).buffer,
      metadata: {
        contentType: 'image/webp',
        encryption: { ...attachmentEncryption(), key: 'thumbnail-key' },
        filename: 'secret.thumbnail.webp',
        size: thumbnailFile.size,
      },
    };
    // Preview uploads first: one reserve and one upload each.
    const request = jest
      .fn()
      .mockResolvedValueOnce({
        blobId: 'thumbnail-blob',
        downloadToken: 'thumbnail-download-token-1',
        expiresAt: 1,
        uploadToken: 'thumbnail-upload-token-1',
      })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        blobId: 'original-blob',
        downloadToken: 'original-download-token-1',
        expiresAt: 2,
        uploadToken: 'original-upload-token-1',
      })
      .mockResolvedValueOnce(undefined);
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

    await expect(uploader.publishEncrypted(session, file)).resolves.toEqual({
      ...pendingOriginal.metadata,
      blobs: [
        {
          blobId: 'original-blob',
          downloadToken: 'original-download-token-1',
          expiresAt: 2,
          index: 0,
          size: 3,
        },
      ],
      encrypted: true,
      encryptedSize: 3,
      preview: {
        ...pendingThumbnail.metadata,
        blobs: [
          {
            blobId: 'thumbnail-blob',
            downloadToken: 'thumbnail-download-token-1',
            expiresAt: 1,
            index: 0,
            size: 3,
          },
        ],
        encrypted: true,
        encryptedSize: 3,
      },
    });

    expect(thumbnailPreparer.prepare).toHaveBeenCalledWith(file);
    expect(cipher.encrypt).toHaveBeenCalledWith(thumbnailFile);
    expect(cipher.encrypt).toHaveBeenCalledWith(file, undefined);
    expect(request).toHaveBeenCalledTimes(4);
  });
});
