import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { PigeonPublicFilesClient } from '../../../../../contexts/attachments/infrastructure/http/PigeonPublicFilesClient';

describe(PigeonPublicFilesClient.name, () => {
  it('maps public binary content and reports download progress', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    const http = {
      request: jest.fn(),
      requestBlob: jest.fn().mockImplementation(
        (
          _path: string,
          options: {
            onDownloadProgress?: (progress: {
              loadedBytes: number;
              totalBytes?: number;
            }) => void;
          },
        ) => {
          options.onDownloadProgress?.({ loadedBytes: 5, totalBytes: 10 });

          return Promise.resolve(blob);
        },
      ),
    };
    const progress = jest.fn();
    const client = new PigeonPublicFilesClient(http, { headers: jest.fn() });

    await expect(client.fetch('external/id', progress)).resolves.toMatchObject({
      blob,
      cid: 'external/id',
      contentType: 'text/plain',
      filename: 'external/id',
      size: 5,
    });
    expect(http.requestBlob).toHaveBeenCalledWith(
      '/ipfs/external%2Fid',
      expect.any(Object),
    );
    expect(progress).toHaveBeenCalledWith(50);
  });

  it('signs public uploads using the public attachment path', async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const session = {} as Session;
    const upload = {
      cid: 'external-1',
      contentType: 'image/webp',
      filename: 'photo.webp',
      size: 3,
    };
    const http = {
      request: jest.fn().mockResolvedValue(upload),
      requestBlob: jest.fn(),
    };
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'signature' }),
    };
    const client = new PigeonPublicFilesClient(http, signer);

    await expect(
      client.upload(session, bytes, 'photo.webp', 'image/webp'),
    ).resolves.toBe(upload);
    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'POST',
      '/ipfs/public',
      bytes,
    );
    expect(http.request).toHaveBeenCalledWith(
      '/ipfs/public',
      expect.objectContaining({ body: bytes, method: 'POST' }),
    );
  });
});
