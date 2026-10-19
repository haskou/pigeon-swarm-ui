import type { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestCache } from '../../../../shared/infrastructure/http/RequestCache';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { KeychainCipher, KeychainHead } from '../crypto/KeychainCipher';
import type {
  LocalKeychain,
  LocalKeychainUpdate,
} from '../keychain/LocalKeychain';
import type { Session } from '../session/Session';
import type { KeychainResource } from './resources/KeychainResource';

import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';
import { retryReplicatedStateRead } from '../../../../shared/infrastructure/http/retryReplicatedStateRead';

const remoteKeychainCacheTtlMs = 1500;

function keychainPath(session: Session): string {
  return `/keychains/${encodeURIComponent(session.identity.id)}`;
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
    const resource = await this.readWithReplicationLag(
      async () => await this.fetchRemote(session),
      session,
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

  private async readWithReplicationLag<T>(
    read: () => Promise<T>,
    session: Session,
    signal?: AbortSignal,
  ): Promise<T | undefined> {
    // Only a session that already holds a keychain pointer knows a keychain
    // exists, so only it reads a missing keychain as lag. Sessions without a
    // pointer (login, registration) read once and are never delayed.
    const expected = Boolean(session.keychainExternalIdentifier);

    return await retryReplicatedStateRead(
      async () => await this.undefinedWhenMissing(read),
      { isPending: (value) => expected && value === undefined, signal },
    );
  }

  // Waits out a node still opening; a missing head reads as undefined.
  private async fetchRemoteWhenReady(
    session: Session,
  ): Promise<KeychainResource | undefined> {
    return await retryReplicatedStateRead(
      async () =>
        await this.undefinedWhenMissing(
          async () => await this.fetchRemote(session),
        ),
    );
  }

  private async postKeychain(
    session: Session,
    head: KeychainHead | undefined,
    keychain: LocalKeychain,
  ): Promise<{ keychain: LocalKeychain; keychainExternalIdentifier: string }> {
    const path = '/keychains';
    const encrypted = this.cipher.encryptForPublish(session, head, keychain);
    const published = await this.http.request<{
      keychainExternalIdentifier: string;
      ownerIdentityId: string;
      version: number;
    }>(path, {
      body: JSON.stringify(encrypted.body),
      headers: await this.signer.headers(session, 'POST', path, encrypted.body),
      method: 'POST',
    });
    this.requestCache.invalidateForSession(keychainPath(session), session);

    return {
      keychain: encrypted.keychain,
      keychainExternalIdentifier: published.keychainExternalIdentifier,
    };
  }

  /**
   * Opens the head with openWith and reseals it under the session's root. A
   * head already under the root, or a missing head, is left alone.
   */
  private async resealHeadUnderRoot(
    session: Session,
    openWith: Session,
  ): Promise<void> {
    await this.enqueuePublish(session.identity.id, async () => {
      const resource = await this.fetchRemoteWhenReady(session);

      if (!resource || this.cipher.isSealedUnderRoot(session, resource)) {
        return;
      }

      const head: KeychainHead = {
        keychain: this.cipher.decrypt(openWith, resource),
        keychainExternalIdentifier: resource.keychainExternalIdentifier,
      };

      await this.postKeychain(session, head, head.keychain);
    });
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
    options: { signal?: AbortSignal } = {},
  ): Promise<KeychainResource | undefined> {
    return await this.readWithReplicationLag(
      async () => await this.load(session),
      session,
      options.signal,
    );
  }

  public async publishKeychain(
    session: Session,
    update: LocalKeychainUpdate,
  ): Promise<{ keychain: LocalKeychain; keychainExternalIdentifier: string }> {
    return await this.enqueuePublish(session.identity.id, async () => {
      const head = await this.readPublishHead(session);

      return await this.postKeychain(
        session,
        head,
        update(head?.keychain ?? session.keychain),
      );
    });
  }

  /**
   * Reads the current head under the session's root, before the root moves.
   */
  public async readHead(session: Session): Promise<KeychainHead | undefined> {
    return await this.readPublishHead(session);
  }

  /**
   * Seals a head read under the previous root with this session's root, so a
   * revoke moves the keychain before the previous root is dropped.
   */
  public async rewrapHead(session: Session, head: KeychainHead): Promise<void> {
    await this.enqueuePublish(session.identity.id, async () => {
      await this.postKeychain(session, head, head.keychain);
    });
  }

  /**
   * Reseals a head that a failed revoke rewrap left under the previous root:
   * it opens under previousKey and is sealed under the session's root. A head
   * already under the root is left alone.
   */
  public async rewrapHeadSealedUnder(
    session: Session,
    previousKey: SymmetricKey,
  ): Promise<void> {
    await this.resealHeadUnderRoot(session, {
      ...session,
      deviceSealedRootKey: previousKey,
    });
  }

  /**
   * Replaces a head that does not open under the session's root with an empty
   * keychain sealed under it, chained to the head it replaces. Only for a
   * device a recovery kit authorized as the identity's only device: the root
   * the head was sealed under left with the devices the recovery replaced, so
   * its conversation keys cannot be read by anyone. A head already under the
   * root, or a missing head, is left alone.
   */
  public async replaceHeadAfterRecovery(session: Session): Promise<void> {
    if (!session.deviceSealedRootKey) {
      throw new Error('Device sealed root is not open.');
    }

    await this.enqueuePublish(session.identity.id, async () => {
      const resource = await this.fetchRemoteWhenReady(session);

      if (!resource || this.cipher.isSealedUnderRoot(session, resource)) {
        return;
      }

      const unreadable: KeychainHead = {
        keychain: { conversations: {}, version: resource.version },
        keychainExternalIdentifier: resource.keychainExternalIdentifier,
      };

      await this.postKeychain(session, unreadable, {
        conversations: {},
        version: resource.version,
      });
    });
  }
}
