import type { Session } from '../../domain/types';

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
      path: '/conversations/',
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
      path: '/notifications/',
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
      path: '/messages',
      timestamp: '123',
    });
    expect(signedPassword(sign)).toBe('secret');
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
      path: '/keychains/',
      timestamp: '123',
    });
    expect(signedPassword(sign)).toBe('secret');
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
