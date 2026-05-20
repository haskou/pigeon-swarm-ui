import type { Session } from '../../domain/pigeonResources.types';

import { API_SERVER_URL } from '../../../app/API_SERVER_URL';
import { RequestSigner } from './RequestSigner';

type SignedRequestPayload = {
  bodyHash: string;
  method: string;
  nonce: string;
  path: string;
  timestamp: string;
};

function signedPayload(sign: jest.Mock): SignedRequestPayload {
  const [payload] = sign.mock.calls[0] as [string, string];

  return JSON.parse(payload) as SignedRequestPayload;
}

function signedPassword(sign: jest.Mock): string {
  const [, password] = sign.mock.calls[0] as [string, string];

  return password;
}

function routePrefix(): string {
  if (!API_SERVER_URL) return '/';

  const pathname = /^https?:\/\//i.test(API_SERVER_URL)
    ? new URL(API_SERVER_URL).pathname
    : API_SERVER_URL;
  const trimmed = pathname.replace(/^\/+|\/+$/g, '');

  return trimmed ? `/${trimmed}` : '/';
}

function expectedSignedPath(path: string): string {
  const requestPath = `/${path.replace(/^\/+/, '').split('?')[0]}`;
  const prefix = routePrefix();

  if (
    prefix === '/' ||
    requestPath === prefix ||
    requestPath.startsWith(`${prefix}/`)
  ) {
    return requestPath;
  }

  return `${prefix}${requestPath}`;
}
describe(RequestSigner.name, () => {
  it('builds the canonical payload used for signatures', () => {
    const signer = new RequestSigner(
      () => 123,
      () => 'nonce-1',
    );

    const payload = JSON.parse(
      signer.payload('post', '/conversations/', '123', 'nonce-1', {
        hello: 'world',
      }),
    ) as SignedRequestPayload;

    expect(payload).toEqual({
      bodyHash: expect.any(String),
      method: 'POST',
      nonce: 'nonce-1',
      path: expectedSignedPath('/conversations/'),
      timestamp: '123',
    });
  });

  it('signs only the request path and leaves query params out', () => {
    const signer = new RequestSigner(
      () => 123,
      () => 'nonce-1',
    );

    const payload = JSON.parse(
      signer.payload('GET', '/notifications/?limit=30', '123', 'nonce-1'),
    ) as SignedRequestPayload;

    expect(payload).toEqual({
      bodyHash: expect.any(String),
      method: 'GET',
      nonce: 'nonce-1',
      path: expectedSignedPath('/notifications/'),
      timestamp: '123',
    });
  });

  it('signs headers with the session keypair', async () => {
    const sign = jest.fn().mockResolvedValue({ toString: () => 'signature' });
    const signer = new RequestSigner(
      () => 123,
      () => 'nonce-1',
    );
    const session = {
      encryptedKeyPair: { sign },
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;

    await expect(signer.headers(session, 'GET', '/messages')).resolves.toEqual({
      'X-Identity-Id': 'identity-1',
      'X-Nonce': 'nonce-1',
      'X-Signature': 'signature',
      'X-Timestamp': '123',
    });
    expect(sign).toHaveBeenCalledTimes(1);
    expect(signedPayload(sign)).toEqual({
      bodyHash: expect.any(String),
      method: 'GET',
      nonce: 'nonce-1',
      path: expectedSignedPath('/messages'),
      timestamp: '123',
    });
    expect(signedPassword(sign)).toBe('secret');
  });

  it('does not prefix an already-prefixed request path twice', () => {
    const signer = new RequestSigner(
      () => 123,
      () => 'nonce-1',
    );

    const payload = JSON.parse(
      signer.payload('GET', '/api/ws', '123', 'nonce-1', {}),
    ) as SignedRequestPayload;

    expect(payload).toEqual({
      bodyHash: expect.any(String),
      method: 'GET',
      nonce: 'nonce-1',
      path: '/api/ws',
      timestamp: '123',
    });
  });

  it('normalizes PEM identity ids in HTTP signature headers', async () => {
    const sign = jest.fn().mockResolvedValue({ toString: () => 'signature' });
    const signer = new RequestSigner(
      () => 123,
      () => 'nonce-1',
    );
    const session = {
      encryptedKeyPair: { sign },
      identity: {
        id: '-----BEGIN PUBLIC KEY-----\nidentity-1\n-----END PUBLIC KEY-----',
      },
      password: 'secret',
    } as unknown as Session;

    await expect(signer.headers(session, 'GET', '/messages')).resolves.toEqual(
      expect.objectContaining({
        'X-Identity-Id': 'identity-1',
      }),
    );
  });

  it('signs long request payloads without string value object limits', async () => {
    const sign = jest.fn().mockResolvedValue({ toString: () => 'signature' });
    const signer = new RequestSigner(
      () => 123,
      () => 'nonce-1',
    );
    const session = {
      encryptedKeyPair: { sign },
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;
    const body = { encryptedPayload: 'x'.repeat(6000) };

    await signer.headers(session, 'POST', '/keychains/', body);

    expect(signedPayload(sign)).toEqual({
      bodyHash: expect.any(String),
      method: 'POST',
      nonce: 'nonce-1',
      path: expectedSignedPath('/keychains/'),
      timestamp: '123',
    });
    expect(signedPassword(sign)).toBe('secret');
  });

  it('hashes raw upload bytes instead of JSON stringifying them', async () => {
    const sign = jest.fn().mockResolvedValue({ toString: () => 'signature' });
    const signer = new RequestSigner(
      () => 123,
      () => 'nonce-1',
    );
    const session = {
      encryptedKeyPair: { sign },
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;
    const bytes = new Uint8Array([1, 2, 3]);

    await signer.headers(session, 'POST', '/ipfs/public', bytes.buffer);
    const arrayBufferPayload = signedPayload(sign);

    sign.mockClear();
    await signer.headers(session, 'POST', '/ipfs/public', bytes);
    const typedArrayPayload = signedPayload(sign);

    sign.mockClear();
    await signer.headers(session, 'POST', '/ipfs/public', Array.from(bytes));
    const jsonPayload = signedPayload(sign);

    expect(arrayBufferPayload).toEqual({
      bodyHash: typedArrayPayload.bodyHash,
      method: 'POST',
      nonce: 'nonce-1',
      path: expectedSignedPath('/ipfs/public'),
      timestamp: '123',
    });
    expect(arrayBufferPayload.bodyHash).not.toBe(jsonPayload.bodyHash);
  });

  it('uses a bound crypto random UUID nonce by default', async () => {
    const sign = jest.fn().mockResolvedValue({ toString: () => 'signature' });
    const session = {
      encryptedKeyPair: { sign },
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;

    await expect(
      new RequestSigner(() => 123).headers(session, 'GET', '/messages'),
    ).resolves.toEqual(
      expect.objectContaining({
        'X-Nonce': expect.any(String),
        'X-Signature': 'signature',
      }),
    );
  });
});
