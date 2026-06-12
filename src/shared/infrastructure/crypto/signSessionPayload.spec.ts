import type { Session } from '../../domain/pigeonResources.types';

import { signSessionPayload } from './signSessionPayload';

describe(signSessionPayload.name, () => {
  it('signs with the unlocked session key pair when available', async () => {
    const signature = { toString: () => 'signature' };
    const keyPairSign = jest.fn().mockReturnValue(signature);
    const encryptedKeyPairSign = jest.fn();
    const session = {
      encryptedKeyPair: { sign: encryptedKeyPairSign },
      keyPair: { sign: keyPairSign },
      password: 'secret',
    } as unknown as Session;

    await expect(signSessionPayload(session, 'payload')).resolves.toBe(
      signature,
    );
    expect(keyPairSign).toHaveBeenCalledWith('payload');
    expect(encryptedKeyPairSign).not.toHaveBeenCalled();
  });

  it('falls back to the encrypted key pair for incomplete legacy sessions', async () => {
    const signature = { toString: () => 'signature' };
    const encryptedKeyPairSign = jest.fn().mockResolvedValue(signature);
    const session = {
      encryptedKeyPair: { sign: encryptedKeyPairSign },
      password: 'secret',
    } as unknown as Session;

    await expect(signSessionPayload(session, 'payload')).resolves.toBe(
      signature,
    );
    expect(encryptedKeyPairSign).toHaveBeenCalledWith('payload', 'secret');
  });
});
