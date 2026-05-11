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
  });
});
