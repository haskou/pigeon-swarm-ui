import type {
  KeychainResource,
  LocalKeychain,
  LocalKeychainUpdate,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestCache } from '../../../../shared/infrastructure/http/RequestCache';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { KeychainCipher, KeychainHead } from '../crypto/KeychainCipher';

import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';

const remoteKeychainCacheTtlMs = 1500;
// Keychain reads can trail the write that created them. A keychain expected to
// exist is re-read on this schedule (about 10s in total) before it is reported
// missing.
const keychainLagRetryDelaysMs = [250, 500, 1000, 2000, 3000, 3000];

function keychainPath(session: Session): string {
  return `/keychains/${encodeURIComponent(session.identity.id)}`;
}

function waitBeforeRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);

      return;
    }

    const timer = setTimeout(resolve, delayMs);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal?.reason);
      },
      { once: true },
    );
  });
}

export class PigeonKeychainApi {
  private readonly publishQueues = new Map<string, Promise<unknown>>();

  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    private readonly cipher: KeychainCipher,
    private readonly requestCache: RequestCache,
  ) {}

  private async enqueuePublish<T>(
    identityId: string,
    publish: () => Promise<T>,
  ): Promise<T> {
    const previous: Promise<unknown> =
      this.publishQueues.get(identityId) ?? Promise.resolve();
    const current = previous.then(publish);
    this.publishQueues.set(
      identityId,
      current.catch(() => undefined),
    );

    return await current;
  }

  private async readPublishHead(
    session: Session,
  ): Promise<KeychainHead | undefined> {
    const resource = await this.undefinedWhenMissing(
      async () => await this.fetchRemote(session),
    );

    if (!resource) {
      return undefined;
    }

    return {
      keychain: this.decrypt(session, resource),
      keychainExternalIdentifier: resource.keychainExternalIdentifier,
    };
  }

  private async fetchRemote(session: Session): Promise<KeychainResource> {
    const path = keychainPath(session);

    return await this.http.request<KeychainResource>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });
  }

  private async undefinedWhenMissing<T>(
    read: () => Promise<T>,
  ): Promise<T | undefined> {
    try {
      return await read();
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

  public decrypt(session: Session, keychain: KeychainResource): LocalKeychain {
    return this.cipher.decrypt(session, keychain);
  }

  public async load(session: Session): Promise<KeychainResource> {
    return await this.requestCache.load(
      this.requestCache.keyForSession(keychainPath(session), session),
      async () => await this.fetchRemote(session),
      { ttlMs: remoteKeychainCacheTtlMs },
    );
  }

  public async loadOptional(
    session: Session,
    options: {
      // False only before the first keychain can exist, e.g. registration.
      expected: boolean;
      signal?: AbortSignal;
    },
  ): Promise<KeychainResource | undefined> {
    for (let attempt = 0; ; attempt++) {
      const resource = await this.undefinedWhenMissing(
        async () => await this.load(session),
      );

      if (
        resource ||
        !options.expected ||
        attempt >= keychainLagRetryDelaysMs.length
      ) {
        return resource;
      }

      await waitBeforeRetry(keychainLagRetryDelaysMs[attempt], options.signal);
    }
  }

  public async publishKeychain(
    session: Session,
    update: LocalKeychainUpdate,
  ): Promise<{ keychain: LocalKeychain; keychainExternalIdentifier: string }> {
    return await this.enqueuePublish(session.identity.id, async () => {
      const path = '/keychains/';
      const head = await this.readPublishHead(session);
      const encrypted = await this.cipher.encryptForPublish(
        session,
        head,
        update(head?.keychain ?? session.keychain),
      );
      const published = await this.http.request<{
        keychainExternalIdentifier: string;
        ownerIdentityId: string;
        version: number;
      }>(path, {
        body: JSON.stringify(encrypted.body),
        headers: await this.signer.headers(
          session,
          'POST',
          path,
          encrypted.body,
        ),
        method: 'POST',
      });
      this.requestCache.invalidateForSession(keychainPath(session), session);

      return {
        keychain: encrypted.keychain,
        keychainExternalIdentifier: published.keychainExternalIdentifier,
      };
    });
  }
}
