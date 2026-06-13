import { SHA256Hash } from '@haskou/value-objects';

import type { Session } from '../../domain/pigeonResources.types';

import { RequestSigner } from './RequestSigner';

type SignedRequestPayload = {
  bodyHash: string;
  method: string;
  path: string;
  timestamp: number;
};

function signedPayload(sign: jest.Mock): SignedRequestPayload {
  const [payload] = sign.mock.calls[0] as [string];

  return JSON.parse(payload) as SignedRequestPayload;
}

function emptyBodyHash(): string {
  return SHA256Hash.from(JSON.stringify({})).toString();
}

function sessionWithSigner(
  sign: jest.Mock,
  identityId = 'identity-1',
): Session {
  return {
    identity: { id: identityId },
    keyPair: { sign },
    password: 'secret',
  } as unknown as Session;
}

describe(RequestSigner.name, () => {
  it('builds the canonical payload used for signatures', () => {
    const signer = new RequestSigner(() => 123);

    const payload = JSON.parse(
      signer.payload('post', '/conversations/', 123, {
        hello: 'world',
      }),
    ) as SignedRequestPayload;

    expect(payload).toEqual({
      bodyHash: expect.any(String),
      method: 'POST',
      path: '/conversations/',
      timestamp: 123,
    });
  });

  it('signs only the request path and leaves query params out', () => {
    const signer = new RequestSigner(() => 123);

    const payload = JSON.parse(
      signer.payload('GET', '/notifications/?limit=30', 123),
    ) as SignedRequestPayload;

    expect(payload).toEqual({
      bodyHash: expect.any(String),
      method: 'GET',
      path: '/notifications/',
      timestamp: 123,
    });
  });

  it('signs keychain reads with encoded path params and an empty body hash', () => {
    const signer = new RequestSigner(() => 123);
    const identityId = 'identity/with+symbols=';
    const path = `/keychains/${encodeURIComponent(identityId)}`;

    const payload = JSON.parse(
      signer.payload('GET', path, 123),
    ) as SignedRequestPayload;

    expect(payload).toEqual({
      bodyHash: emptyBodyHash(),
      method: 'GET',
      path: '/keychains/identity%2Fwith%2Bsymbols%3D',
      timestamp: 123,
    });
  });

  it('signs headers with the session keypair', async () => {
    const sign = jest.fn().mockResolvedValue({ toString: () => 'signature' });
    const signer = new RequestSigner(() => 123);
    const session = sessionWithSigner(sign);

    await expect(signer.headers(session, 'GET', '/messages')).resolves.toEqual({
      'X-Identity-Id': 'identity-1',
      'X-Signature': 'signature',
      'X-Timestamp': '123',
    });
    expect(sign).toHaveBeenCalledTimes(1);
    expect(signedPayload(sign)).toEqual({
      bodyHash: expect.any(String),
      method: 'GET',
      path: '/messages',
      timestamp: 123,
    });
  });

  it('signs only the URL pathname when passed an absolute URL', () => {
    const signer = new RequestSigner(() => 123);

    const payload = JSON.parse(
      signer.payload('GET', 'https://example.com/keychains/id?limit=1', 123),
    ) as SignedRequestPayload;

    expect(payload).toEqual({
      bodyHash: emptyBodyHash(),
      method: 'GET',
      path: '/keychains/id',
      timestamp: 123,
    });
  });

  it('normalizes PEM identity ids in HTTP signature headers', async () => {
    const sign = jest.fn().mockResolvedValue({ toString: () => 'signature' });
    const signer = new RequestSigner(() => 123);
    const session = sessionWithSigner(
      sign,
      '-----BEGIN PUBLIC KEY-----\nidentity-1\n-----END PUBLIC KEY-----',
    );

    await expect(signer.headers(session, 'GET', '/messages')).resolves.toEqual(
      expect.objectContaining({
        'X-Identity-Id': 'identity-1',
      }),
    );
  });

  it('signs long request payloads without string value object limits', async () => {
    const sign = jest.fn().mockResolvedValue({ toString: () => 'signature' });
    const signer = new RequestSigner(() => 123);
    const session = sessionWithSigner(sign);
    const body = { encryptedPayload: 'x'.repeat(6000) };

    await signer.headers(session, 'POST', '/keychains/', body);

    expect(signedPayload(sign)).toEqual({
      bodyHash: expect.any(String),
      method: 'POST',
      path: '/keychains/',
      timestamp: 123,
    });
  });

  it('hashes raw upload bytes instead of JSON stringifying them', async () => {
    const sign = jest.fn().mockResolvedValue({ toString: () => 'signature' });
    const signer = new RequestSigner(() => 123);
    const session = sessionWithSigner(sign);
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
      path: '/ipfs/public',
      timestamp: 123,
    });
    expect(arrayBufferPayload.bodyHash).not.toBe(jsonPayload.bodyHash);
  });

  it('does not send nonce headers', async () => {
    const sign = jest.fn().mockResolvedValue({ toString: () => 'signature' });
    const session = sessionWithSigner(sign);

    await expect(
      new RequestSigner(() => 123).headers(session, 'GET', '/messages'),
    ).resolves.toEqual(
      expect.not.objectContaining({ 'X-Nonce': expect.any(String) }),
    );
  });
});
