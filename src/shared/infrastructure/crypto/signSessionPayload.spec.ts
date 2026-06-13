import type { Session } from '../../domain/pigeonResources.types';

import { signSessionPayload } from './signSessionPayload';

describe(signSessionPayload.name, () => {
  it('signs with the unlocked session key pair', async () => {
    const signature = { toString: () => 'signature' };
    const keyPairSign = jest.fn().mockReturnValue(signature);
    const session = {
      keyPair: { sign: keyPairSign },
      password: 'secret',
    } as unknown as Session;

    await expect(signSessionPayload(session, 'payload')).resolves.toBe(
      signature,
    );
    expect(keyPairSign).toHaveBeenCalledWith('payload');
  });
});
