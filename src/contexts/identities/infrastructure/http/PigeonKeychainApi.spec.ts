import type {
  KeychainResource,
  LocalKeychain,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestCache } from '../../../../shared/infrastructure/http/RequestCache';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { KeychainCipher } from '../crypto/KeychainCipher';

import { PigeonKeychainApi } from './PigeonKeychainApi';

describe(PigeonKeychainApi.name, () => {
  const session = {
    identity: { id: 'identity-1' },
  } as unknown as Session;

  it('loads a signed remote keychain through the request cache', async () => {
    const resource = { encryptedPayload: 'encrypted' } as KeychainResource;
    const request = jest.fn().mockResolvedValue(resource);
    const headers = jest.fn().mockResolvedValue({});
    const load = jest
      .fn<
        Promise<KeychainResource>,
        [string, () => Promise<KeychainResource>, { ttlMs?: number }]
      >()
      .mockImplementation(async (_key, loader) => await loader());
    const api = new PigeonKeychainApi(
      { request } as unknown as HttpJsonClient,
      { headers } as unknown as RequestSigner,
      {} as KeychainCipher,
      {
        keyForSession: jest.fn().mockReturnValue('cache-key'),
        load,
      } as unknown as RequestCache,
    );

    await expect(api.load(session)).resolves.toBe(resource);
    expect(request).toHaveBeenCalledWith('/keychains/identity-1', {
      headers: {},
      method: 'GET',
    });
    expect(load).toHaveBeenCalledWith('cache-key', expect.any(Function), {
      ttlMs: 1500,
    });
  });

  it('decrypts through the keychain cipher', () => {
    const keychain = { conversations: {}, version: 1 } as LocalKeychain;
    const decrypt = jest.fn().mockReturnValue(keychain);
    const api = new PigeonKeychainApi(
      {} as HttpJsonClient,
      {} as RequestSigner,
      { decrypt } as unknown as KeychainCipher,
      {} as RequestCache,
    );
    const resource = { encryptedPayload: 'encrypted' } as KeychainResource;

    expect(api.decrypt(session, resource)).toBe(keychain);
    expect(decrypt).toHaveBeenCalledWith(session, resource);
  });
});
