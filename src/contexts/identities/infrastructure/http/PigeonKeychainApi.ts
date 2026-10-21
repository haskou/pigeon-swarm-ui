import type { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestCache } from '../../../../shared/infrastructure/http/RequestCache';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { ReplicatedStateReadOptions } from '../../../../shared/infrastructure/http/retryReplicatedStateRead';
import type { KeychainCipher, KeychainHead } from '../crypto/KeychainCipher';
import type { PublishedKeychainPayload } from '../crypto/PublishedKeychainPayload';
import type {
  LocalKeychain,
  LocalKeychainUpdate,
} from '../keychain/LocalKeychain';
import type { Session } from '../session/Session';
import type { DeviceIdentityVault } from '../storage/DeviceIdentityVault';
import type { FirstKeychainPublishState } from '../storage/DeviceIdentityVaultRecord';
import type { KeychainResource } from './resources/KeychainResource';

import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';
import { retryReplicatedStateRead } from '../../../../shared/infrastructure/http/retryReplicatedStateRead';
import { IdentityId } from '../../domain/value-objects/IdentityId';
import { KeychainHeadUnavailableError } from './errors/KeychainHeadUnavailableError';
import { KeychainNotFoundError } from './errors/KeychainNotFoundError';

const remoteKeychainCacheTtlMs = 1500;
const keychainsPath = '/keychains';

// A keychain post sealed and signed locally, not yet sent.
type PreparedKeychainPost = {
  body: PublishedKeychainPayload;
  headers: Record<string, string>;
  keychain: LocalKeychain;
};

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
    private readonly vault: DeviceIdentityVault,
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
    options: ReplicatedStateReadOptions = {},
  ): Promise<T | undefined> {
    // Only a session that already holds a keychain pointer knows a keychain
    // exists, so only it reads a missing keychain as lag. Sessions without a
    // pointer (login, registration) read once and are never delayed.
    const expected = Boolean(session.keychainExternalIdentifier);

    return await retryReplicatedStateRead(
      async () => await this.undefinedWhenMissing(read),
      {
        isPending: (value) => expected && value === undefined,
        onNotReady: options.onNotReady,
        signal: options.signal,
      },
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
    return await this.sendKeychainPost(
      session,
      await this.prepareKeychainPost(session, head, keychain),
    );
  }

  // Seals and signs the post locally; nothing reaches the node, so a throw
  // here proves nothing was sent.
  private async prepareKeychainPost(
    session: Session,
    head: KeychainHead | undefined,
    keychain: LocalKeychain,
  ): Promise<PreparedKeychainPost> {
    const encrypted = this.cipher.encryptForPublish(session, head, keychain);

    return {
      body: encrypted.body,
      headers: await this.signer.headers(
        session,
        'POST',
        keychainsPath,
        encrypted.body,
      ),
      keychain: encrypted.keychain,
    };
  }

  private async sendKeychainPost(
    session: Session,
    prepared: PreparedKeychainPost,
  ): Promise<{ keychain: LocalKeychain; keychainExternalIdentifier: string }> {
    const published = await this.http.request<{
      keychainExternalIdentifier: string;
      ownerIdentityId: string;
      version: number;
    }>(keychainsPath, {
      body: JSON.stringify(prepared.body),
      headers: prepared.headers,
      method: 'POST',
    });
    this.requestCache.invalidateForSession(keychainPath(session), session);

    return {
      keychain: prepared.keychain,
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

  /**
   * Posts an identity's first keychain without a head, the only pointer-less
   * publish allowed, and only from `armed`. The post is sealed and signed
   * first, so a local failure leaves the marker `armed`. The marker then moves
   * `armed` -> `ambiguous` atomically before the POST, so a post that loses
   * its answer is never repeated head-less and two tabs never both post. A
   * definitive 4xx refusal commits nothing and returns the marker to `armed`
   * unless another tab moved it meanwhile. `ambiguous` never posts; it clears
   * only when a head is adopted. `none` never posts.
   */
  private async publishFirstKeychain(
    session: Session,
    identityId: IdentityId,
    state: FirstKeychainPublishState,
    update: LocalKeychainUpdate,
  ): Promise<{ keychain: LocalKeychain; keychainExternalIdentifier: string }> {
    if (state === 'none') {
      throw new KeychainNotFoundError();
    }

    if (state === 'ambiguous') {
      throw new KeychainHeadUnavailableError('ambiguous');
    }

    const prepared = await this.prepareKeychainPost(
      session,
      undefined,
      update(session.keychain),
    );

    // Written before the POST, so a failed write sends nothing. A marker no
    // longer armed means another tab started this first publish.
    if (
      !(await this.vault.transitionFirstKeychainPublish(
        identityId,
        'armed',
        'ambiguous',
      ))
    ) {
      throw new KeychainHeadUnavailableError('ambiguous');
    }

    let published: {
      keychain: LocalKeychain;
      keychainExternalIdentifier: string;
    };

    try {
      published = await this.sendKeychainPost(session, prepared);
    } catch (caught: unknown) {
      await this.rearmAfterRefusal(identityId, caught);
      throw caught;
    }

    await this.vault.clearFirstKeychainPublish(identityId);

    return published;
  }

  // A definitive 4xx refusal commits nothing, so the first publish is armed
  // again, unless another tab moved the marker meanwhile. Any other failure
  // may have committed and stays ambiguous. The node returns 4xx from
  // POST /keychains only before commit (pigeon-swarm-node origin/main
  // 31fc9d20: PostKeychainRoute.ts:22-50, KeychainPublisher.ts:46-71, commit
  // at line 71). Keep in step with it.
  private async rearmAfterRefusal(
    identityId: IdentityId,
    caught: unknown,
  ): Promise<void> {
    if (
      caught instanceof HttpJsonError &&
      caught.status >= 400 &&
      caught.status < 500 &&
      caught.status !== 408
    ) {
      await this.vault.transitionFirstKeychainPublish(
        identityId,
        'ambiguous',
        'armed',
      );
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
    options: ReplicatedStateReadOptions = {},
  ): Promise<KeychainResource | undefined> {
    return await this.readWithReplicationLag(
      async () => await this.load(session),
      session,
      options,
    );
  }

  /**
   * Publishes the session's keychain. A publish with no pointer may post a
   * head-less keychain only from the `armed` marker. An `ambiguous` marker is
   * resolved only by adopting a head the node reports, so while no head is
   * readable the publish is refused before any POST. A pointer whose head
   * cannot be read is refused the same way, so a pointer never reaches the
   * head-less path.
   */
  public async publishKeychain(
    session: Session,
    update: LocalKeychainUpdate,
  ): Promise<{ keychain: LocalKeychain; keychainExternalIdentifier: string }> {
    return await this.enqueuePublish(session.identity.id, async () => {
      const identityId = IdentityId.fromString(session.identity.id);
      const state = await this.vault.firstKeychainPublishState(identityId);
      let head: KeychainHead | undefined;

      try {
        head = await this.readPublishHead(session);
      } catch (caught: unknown) {
        // An ambiguous first publish can only be resolved by adopting a head,
        // so while the head is unreadable it is refused and stays ambiguous.
        if (state === 'ambiguous') {
          throw new KeychainHeadUnavailableError('ambiguous');
        }

        throw caught;
      }

      // A pointer proves a keychain exists. A head still missing after the lag
      // window is not absence: a root posted without a previous link would sit
      // beside the existing keychain, so the publish is refused instead.
      if (!head && session.keychainExternalIdentifier) {
        throw new KeychainHeadUnavailableError('unreplicated');
      }

      if (!head) {
        return await this.publishFirstKeychain(
          session,
          identityId,
          state,
          update,
        );
      }

      const keychain = update(head.keychain);

      // A head proves the first keychain exists, so a pending or ambiguous
      // first publish is over. Clearing it adopts this head.
      if (state !== 'none') {
        await this.vault.clearFirstKeychainPublish(identityId);
      }

      return await this.postKeychain(session, head, keychain);
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
