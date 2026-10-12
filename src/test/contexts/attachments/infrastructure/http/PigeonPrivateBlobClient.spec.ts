import type { PrivateBlobReference } from '../../../../../contexts/attachments/application/contracts/PrivateBlobReservation';
import type { Session } from '../../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';

import {
  PigeonPrivateBlobClient,
  privateBlobDownloadTimeoutMs,
} from '../../../../../contexts/attachments/infrastructure/http/PigeonPrivateBlobClient';
import { PrivateBlobUnavailableError } from '../../../../../contexts/attachments/infrastructure/http/PrivateBlobUnavailableError';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';

const uploadToken = 'u'.repeat(43);
const downloadToken = 'd'.repeat(43);
const homeOrigin = 'https://home.example';
const foreignOrigin = 'https://node-b.example/pigeon';
const downloadInit = {
  headers: { Authorization: `Bearer ${downloadToken}` },
  redirect: 'error',
  signal: expect.any(AbortSignal),
};

type OriginClient = (
  origin: string,
) => Pick<HttpJsonClient, 'request' | 'requestBlob'>;

function clientWith(
  http: { request?: jest.Mock; requestBlob?: jest.Mock },
  origins: { home?: string; client?: OriginClient; signer?: jest.Mock } = {},
  signer = { headers: jest.fn().mockResolvedValue({}) },
) {
  return new PigeonPrivateBlobClient(
    {
      request: http.request ?? jest.fn(),
      requestBlob: http.requestBlob ?? jest.fn(),
    },
    signer,
    {
      client: origins.client ?? jest.fn(),
      home: () => origins.home,
      signer: origins.signer ?? jest.fn(),
    },
  );
}

function reference(
  overrides: Partial<PrivateBlobReference> = {},
): PrivateBlobReference {
  return {
    blobId: 'blob-1',
    downloadToken,
    expiresAt: 1_700_000_000_000,
    index: 0,
    size: 3,
    ...overrides,
  };
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
    const client = clientWith({ request }, {}, signer);

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

  it('stamps the reservation with the origin of the home node', async () => {
    const request = jest.fn().mockResolvedValue({
      blobId: 'blob-1',
      downloadToken,
      expiresAt: 1,
      uploadToken,
    });
    const client = clientWith({ request }, { home: homeOrigin });

    await expect(client.reserve({} as Session, 3)).resolves.toEqual({
      blobId: 'blob-1',
      downloadToken,
      expiresAt: 1,
      origin: homeOrigin,
      uploadToken,
    });
  });

  it('leaves the origin off the reservation when the home node is not publishable', async () => {
    const request = jest.fn().mockResolvedValue({
      blobId: 'blob-1',
      downloadToken,
      expiresAt: 1,
      uploadToken,
    });
    const client = clientWith({ request }, { home: undefined });

    const reservation = await client.reserve({} as Session, 3);

    expect(reservation).not.toHaveProperty('origin');
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

  it('downloads a reference from its origin through a client isolated to that origin', async () => {
    const requestBlob = jest
      .fn()
      .mockResolvedValue(new Blob([new Uint8Array([4, 5, 6])]));
    const origin = jest.fn().mockReturnValue({ requestBlob });
    const sessionBlob = jest.fn();
    const client = clientWith({ requestBlob: sessionBlob }, { client: origin });

    const content = await client.download(reference({ origin: foreignOrigin }));

    expect(new Uint8Array(content)).toEqual(new Uint8Array([4, 5, 6]));
    expect(origin).toHaveBeenCalledWith(foreignOrigin);
    expect(requestBlob).toHaveBeenCalledWith(
      '/private-blobs/blob-1',
      downloadInit,
    );
    expect(sessionBlob).not.toHaveBeenCalled();
  });

  it('reads a legacy reference without an origin from the session node only', async () => {
    const sessionBlob = jest
      .fn()
      .mockResolvedValue(new Blob([new Uint8Array([4, 5, 6])]));
    const origin = jest.fn();
    const client = clientWith({ requestBlob: sessionBlob }, { client: origin });

    await client.download(reference());

    expect(sessionBlob).toHaveBeenCalledWith(
      '/private-blobs/blob-1',
      downloadInit,
    );
    expect(origin).not.toHaveBeenCalled();
  });

  it.each([
    ['a trailing slash', 'https://node-b.example/'],
    ['plain http off loopback', 'http://node-b.example'],
    ['credentials', 'https://user@node-b.example'],
    ['a query', 'https://node-b.example?x=1'],
    ['a fragment', 'https://node-b.example#x'],
    ['a double slash in the path', 'https://node-b.example//api'],
    ['a private IPv4 host', 'https://10.0.0.5'],
    ['a value over 255 characters', `https://n.example/${'p'.repeat(250)}`],
    ['a non-URL', 'not a url'],
  ])(
    'never fetches an origin with %s and reads the session node instead',
    async (_label, origin) => {
      const sessionBlob = jest
        .fn()
        .mockResolvedValue(new Blob([new Uint8Array([4, 5, 6])]));
      const foreign = jest.fn();
      const client = clientWith(
        { requestBlob: sessionBlob },
        { client: foreign },
      );

      await client.download(reference({ origin }));

      expect(foreign).not.toHaveBeenCalled();
      expect(sessionBlob).toHaveBeenCalledWith(
        '/private-blobs/blob-1',
        downloadInit,
      );
    },
  );

  it('accepts a localhost origin for development', async () => {
    const requestBlob = jest
      .fn()
      .mockResolvedValue(new Blob([new Uint8Array([4, 5, 6])]));
    const origin = jest.fn().mockReturnValue({ requestBlob });
    const client = clientWith({}, { client: origin });

    await client.download(reference({ origin: 'http://localhost:3000' }));

    expect(origin).toHaveBeenCalledWith('http://localhost:3000');
  });

  it('rejects a body whose size differs from the reference as unavailable', async () => {
    const requestBlob = jest
      .fn()
      .mockResolvedValue(new Blob([new Uint8Array([1, 2])]));
    const client = clientWith(
      {},
      { client: () => ({ request: jest.fn(), requestBlob }) },
    );

    await expect(
      client.download(reference({ origin: foreignOrigin, size: 3 })),
    ).rejects.toBeInstanceOf(PrivateBlobUnavailableError);
  });

  it('reports a download for an unknown, expired or wrong capability as unavailable', async () => {
    const requestBlob = jest
      .fn()
      .mockRejectedValue(new HttpJsonError(404, 'Not Found', ''));
    const client = clientWith(
      {},
      { client: () => ({ request: jest.fn(), requestBlob }) },
    );

    await expect(
      client.download(reference({ origin: foreignOrigin })),
    ).rejects.toBeInstanceOf(PrivateBlobUnavailableError);
  });

  it('keeps other download failures as the original HTTP error', async () => {
    const forbidden = new HttpJsonError(403, 'Forbidden', '');
    const client = clientWith({
      requestBlob: jest.fn().mockRejectedValue(forbidden),
    });

    await expect(client.download(reference())).rejects.toBe(forbidden);
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

  it('reserves on a foreign origin through that origin client and signer and stamps the origin', async () => {
    const reserved = {
      blobId: 'blob-1',
      downloadToken,
      expiresAt: 10,
      uploadToken,
    };
    const foreignRequest = jest.fn().mockResolvedValue(reserved);
    const foreignSigner = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'foreign' }),
    };
    const origin = jest.fn().mockReturnValue({
      request: foreignRequest,
      requestBlob: jest.fn(),
    });
    const signerFor = jest.fn().mockReturnValue(foreignSigner);
    const sessionRequest = jest.fn();
    const sessionSigner = { headers: jest.fn() };
    const client = new PigeonPrivateBlobClient(
      { request: sessionRequest, requestBlob: jest.fn() },
      sessionSigner,
      { client: origin, home: () => homeOrigin, signer: signerFor },
    );
    const session = {} as Session;

    await expect(client.reserve(session, 3, foreignOrigin)).resolves.toEqual({
      ...reserved,
      origin: foreignOrigin,
    });
    expect(origin).toHaveBeenCalledWith(foreignOrigin);
    expect(signerFor).toHaveBeenCalledWith(foreignOrigin);
    expect(foreignSigner.headers).toHaveBeenCalledWith(
      session,
      'POST',
      '/private-blobs',
      { size: 3 },
    );
    expect(foreignRequest).toHaveBeenCalledWith(
      '/private-blobs',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(sessionRequest).not.toHaveBeenCalled();
    expect(sessionSigner.headers).not.toHaveBeenCalled();
  });

  it('uploads to the origin of its reservation through that origin client', async () => {
    const foreignRequest = jest.fn().mockResolvedValue(undefined);
    const origin = jest.fn().mockReturnValue({
      request: foreignRequest,
      requestBlob: jest.fn(),
    });
    const sessionRequest = jest.fn();
    const client = clientWith(
      { request: sessionRequest },
      { client: origin, home: homeOrigin },
    );

    await client.upload(
      { blobId: 'blob-1', origin: foreignOrigin, uploadToken },
      new Uint8Array([1]).buffer,
    );

    expect(origin).toHaveBeenCalledWith(foreignOrigin);
    expect(foreignRequest).toHaveBeenCalledWith(
      '/private-blobs/blob-1',
      expect.objectContaining({
        headers: {
          Authorization: `Bearer ${uploadToken}`,
          'Content-Type': 'application/octet-stream',
        },
        method: 'PUT',
      }),
    );
    expect(sessionRequest).not.toHaveBeenCalled();
  });

  it('deletes a foreign replica on its origin with the upload token only', async () => {
    const foreignRequest = jest.fn().mockResolvedValue(undefined);
    const origin = jest.fn().mockReturnValue({
      request: foreignRequest,
      requestBlob: jest.fn(),
    });
    const sessionRequest = jest.fn();
    const client = clientWith(
      { request: sessionRequest },
      { client: origin, home: homeOrigin },
    );

    await client.remove({
      blobId: 'blob-1',
      origin: foreignOrigin,
      uploadToken,
    });

    expect(origin).toHaveBeenCalledWith(foreignOrigin);
    expect(foreignRequest).toHaveBeenCalledWith(
      '/private-blobs/blob-1',
      expect.objectContaining({
        headers: { Authorization: `Bearer ${uploadToken}` },
        method: 'DELETE',
      }),
    );
    expect(sessionRequest).not.toHaveBeenCalled();
  });

  it('deletes a home replica through the session node', async () => {
    const sessionRequest = jest.fn().mockResolvedValue(undefined);
    const origin = jest.fn();
    const client = clientWith(
      { request: sessionRequest },
      { client: origin, home: homeOrigin },
    );

    await client.remove({ blobId: 'blob-1', origin: homeOrigin, uploadToken });

    expect(sessionRequest).toHaveBeenCalledWith(
      '/private-blobs/blob-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(origin).not.toHaveBeenCalled();
  });

  it('aborts a download that stalls past the timeout', async () => {
    jest.useFakeTimers();
    try {
      const requestBlob = jest.fn(
        (_path: string, init: { signal?: AbortSignal }) =>
          new Promise<Blob>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              reject(new Error('aborted'));
            });
          }),
      );
      const client = clientWith({ requestBlob });
      const download = client.download(reference({ origin: undefined }));

      jest.advanceTimersByTime(privateBlobDownloadTimeoutMs);

      await expect(download).rejects.toThrow('aborted');
    } finally {
      jest.useRealTimers();
    }
  });
});
