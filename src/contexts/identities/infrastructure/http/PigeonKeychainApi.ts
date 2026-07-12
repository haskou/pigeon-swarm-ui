import type {
  KeychainResource,
  LocalKeychain,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestCache } from '../../../../shared/infrastructure/http/RequestCache';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { KeychainCipher } from '../crypto/KeychainCipher';

import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';

const remoteKeychainCacheTtlMs = 1500;

export class PigeonKeychainApi {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    private readonly cipher: KeychainCipher,
    private readonly requestCache: RequestCache,
  ) {}

  public decrypt(session: Session, keychain: KeychainResource): LocalKeychain {
    return this.cipher.decrypt(session, keychain);
  }

  public async load(session: Session): Promise<KeychainResource> {
    const path = `/keychains/${encodeURIComponent(session.identity.id)}`;

    return await this.requestCache.load(
      this.requestCache.keyForSession(path, session),
      async () =>
        await this.http.request<KeychainResource>(path, {
          headers: await this.signer.headers(session, 'GET', path),
          method: 'GET',
        }),
      { ttlMs: remoteKeychainCacheTtlMs },
    );
  }

  public async loadOptional(
    session: Session,
  ): Promise<KeychainResource | undefined> {
    try {
      return await this.load(session);
    } catch (caught: unknown) {
      if (
        caught instanceof HttpJsonError &&
        (caught.code === 'KeychainNotFoundError' ||
          caught.code === 'IdentityNotFoundError')
      ) {
        return undefined;
      }

      throw caught;
    }
  }

  public async publish(
    session: Session,
    nextKeychain: LocalKeychain,
  ): Promise<{ keychain: LocalKeychain; keychainExternalIdentifier: string }> {
    const path = '/keychains/';
    const encrypted = await this.cipher.encryptForPublish(
      session,
      nextKeychain,
    );
    const published = await this.http.request<{
      keychainExternalIdentifier: string;
      ownerIdentityId: string;
      version: number;
    }>(path, {
      body: JSON.stringify(encrypted.body),
      headers: await this.signer.headers(session, 'POST', path, encrypted.body),
      method: 'POST',
    });
    this.requestCache.invalidateForSession(
      `/keychains/${encodeURIComponent(session.identity.id)}`,
      session,
    );

    return {
      keychain: encrypted.keychain,
      keychainExternalIdentifier: published.keychainExternalIdentifier,
    };
  }
}
