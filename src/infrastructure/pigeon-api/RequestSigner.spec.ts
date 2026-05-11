import type { Session } from '../../domain/types';

import { RequestSigner } from './RequestSigner';

describe(RequestSigner.name, () => {
  it('builds the canonical payload used for signatures', () => {
    const signer = new RequestSigner(
      () => 123,
      () => 'nonce-1',
    );

    expect(
      signer.payload('post', '/conversations/', '123', 'nonce-1', {
        hello: 'world',
      }),
    ).toBe('POST\n/conversations\n123\nnonce-1\n{"hello":"world"}');
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
    expect(sign).toHaveBeenCalledWith(
      'GET\n/messages\n123\nnonce-1\n',
      'secret',
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

    expect(sign).toHaveBeenCalledWith(
      `POST\n/keychains\n123\nnonce-1\n${JSON.stringify(body)}`,
      'secret',
    );
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
