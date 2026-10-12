import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

import { signSessionPayload } from '../../../../shared/infrastructure/crypto/signSessionPayload';

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
