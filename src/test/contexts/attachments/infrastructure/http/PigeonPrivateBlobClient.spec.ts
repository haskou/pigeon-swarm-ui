import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { PigeonPrivateBlobClient } from '../../../../../contexts/attachments/infrastructure/http/PigeonPrivateBlobClient';
import { PrivateBlobUnavailableError } from '../../../../../contexts/attachments/infrastructure/http/PrivateBlobUnavailableError';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';

const uploadToken = 'u'.repeat(43);
const downloadToken = 'd'.repeat(43);

function clientWith(
  http: { request?: jest.Mock; requestBlob?: jest.Mock },
  signer = { headers: jest.fn().mockResolvedValue({}) },
) {
  return new PigeonPrivateBlobClient(
    {
      request: http.request ?? jest.fn(),
      requestBlob: http.requestBlob ?? jest.fn(),
    },
    signer,
  );
}

describe(PigeonPrivateBlobClient.name, () => {
  it('reserves a blob with a signed JSON body and returns its capabilities', async () => {
    const session = {} as Session;
    const reservation = {
      blobId: 'blob-1',
      downloadToken,
      expiresAt: 1_700_000_000_000,
      uploadToken,
    };
    const request = jest.fn().mockResolvedValue(reservation);
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'signature' }),
    };
    const client = clientWith({ request }, signer);

    await expect(client.reserve(session, 3)).resolves.toEqual(reservation);
    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'POST',
      '/private-blobs',
      { size: 3 },
    );
    expect(request).toHaveBeenCalledWith('/private-blobs', {
      body: '{"size":3}',
      headers: { 'X-Signature': 'signature' },
      method: 'POST',
    });
  });

  it('uploads exact bytes authorized only by the upload capability', async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const request = jest.fn().mockResolvedValue(undefined);
    const client = clientWith({ request });

    await client.upload({ blobId: 'blob-1', uploadToken }, bytes);

    expect(request).toHaveBeenCalledWith('/private-blobs/blob-1', {
      body: bytes,
      headers: {
        Authorization: `Bearer ${uploadToken}`,
        'Content-Type': 'application/octet-stream',
      },
      method: 'PUT',
    });
  });

  it('downloads a blob authorized only by the download capability', async () => {
    const bytes = new Uint8Array([4, 5, 6]);
    const requestBlob = jest.fn().mockResolvedValue(new Blob([bytes]));
    const client = clientWith({ requestBlob });

    const content = await client.download({ blobId: 'blob-1', downloadToken });

    expect(new Uint8Array(content)).toEqual(bytes);
    expect(requestBlob).toHaveBeenCalledWith('/private-blobs/blob-1', {
      headers: { Authorization: `Bearer ${downloadToken}` },
    });
  });

  it('reports a download for an unknown, expired or wrong capability as unavailable', async () => {
    const requestBlob = jest
      .fn()
      .mockRejectedValue(new HttpJsonError(404, 'Not Found', ''));
    const client = clientWith({ requestBlob });

    await expect(
      client.download({ blobId: 'blob-1', downloadToken }),
    ).rejects.toBeInstanceOf(PrivateBlobUnavailableError);
  });

  it('reports an upload whose reservation is gone as unavailable', async () => {
    const request = jest
      .fn()
      .mockRejectedValue(new HttpJsonError(404, 'Not Found', ''));
    const client = clientWith({ request });

    await expect(
      client.upload({ blobId: 'blob-1', uploadToken }, new ArrayBuffer(1)),
    ).rejects.toBeInstanceOf(PrivateBlobUnavailableError);
  });

  it('keeps other failures as the original HTTP error', async () => {
    const quota = new HttpJsonError(413, 'Payload Too Large', '');
    const conflict = new HttpJsonError(409, 'Conflict', '');
    const client = clientWith({
      request: jest
        .fn()
        .mockRejectedValueOnce(quota)
        .mockRejectedValueOnce(conflict),
    });

    await expect(client.reserve({} as Session, 1)).rejects.toBe(quota);
    await expect(
      client.upload({ blobId: 'blob-1', uploadToken }, new ArrayBuffer(1)),
    ).rejects.toBe(conflict);
  });
});
