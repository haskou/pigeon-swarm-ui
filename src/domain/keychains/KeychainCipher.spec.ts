import type { Session } from '../types';

import { KeychainCipher } from './KeychainCipher';

describe(KeychainCipher.name, () => {
  it('signs keychain payloads with owner identity and undefined previous keychain', async () => {
    const sign = jest.fn().mockResolvedValue({ toString: () => 'signature' });
    const encrypt = jest.fn().mockReturnValue({ toString: () => 'encrypted' });
    const session = {
      encryptedKeyPair: { encrypt, sign },
      identity: { id: 'identity-1' },
      keychain: { conversations: {}, version: 0 },
      keychainExternalIdentifier: null,
      password: 'secret',
    } as unknown as Session;

    const result = await new KeychainCipher().encryptForPublish(session, {
      conversations: {},
      version: 1,
    });
    const [signaturePayload, signaturePassword] = sign.mock.calls[0] as [
      string,
      string,
    ];

    expect(JSON.parse(signaturePayload)).toEqual({
      encryptedPayload: 'encrypted',
      ownerIdentityId: 'identity-1',
      timestamp: expect.any(Number),
      version: 1,
    });
    expect(signaturePassword).toBe('secret');
    expect(result.body).toEqual({
      encryptedPayload: 'encrypted',
      previousKeychainExternalIdentifier: null,
      signature: 'signature',
      timestamp: expect.any(Number),
      version: 1,
    });
  });

  it('includes previous keychain external identifier in the signed payload when present', async () => {
    const sign = jest.fn().mockResolvedValue({ toString: () => 'signature' });
    const encrypt = jest.fn().mockReturnValue({ toString: () => 'encrypted' });
    const session = {
      encryptedKeyPair: { encrypt, sign },
      identity: { id: 'identity-1' },
      keychain: { conversations: {}, version: 1 },
      keychainExternalIdentifier: 'keychain-previous',
      password: 'secret',
    } as unknown as Session;

    await new KeychainCipher().encryptForPublish(session, {
      conversations: {},
      version: 2,
    });
    const [signaturePayload] = sign.mock.calls[0] as [string, string];

    expect(JSON.parse(signaturePayload)).toEqual({
      encryptedPayload: 'encrypted',
      ownerIdentityId: 'identity-1',
      previousKeychainExternalIdentifier: 'keychain-previous',
      timestamp: expect.any(Number),
      version: 2,
    });
  });
});
