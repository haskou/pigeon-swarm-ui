import type { ConversationResource } from '../../../conversations/infrastructure/http/ConversationResource';
import type { LoginIdentityProgressReporter } from '../../application/login-identity/LoginIdentityProgressReporter';
import type { LocalKeychain } from '../keychain/LocalKeychain';
import type { Session } from '../session/Session';
import type { IdentityWorkspaceSource } from './IdentityWorkspaceSource';
import type { KeychainResource } from './resources/KeychainResource';
import type { LoginResult } from './resources/LoginResult';

import { retryReplicatedStateRead } from '../../../../shared/infrastructure/http/retryReplicatedStateRead';
import { IdentitySnapshotSelection } from '../../domain/IdentitySnapshotSelection';
import { KeychainVersion } from '../../domain/value-objects/KeychainVersion';
import { KeychainHeadUnavailableError } from './errors/KeychainHeadUnavailableError';

const emptyKeychain: LocalKeychain = {
  conversations: {},
  version: 0,
};

export class PigeonIdentityWorkspaceSessionApi {
  public constructor(private readonly workspace: IdentityWorkspaceSource) {}

  private async listConversations(
    session: Session,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<ConversationResource[]> {
    return await retryReplicatedStateRead(
      async () => await this.workspace.listConversations(session),
      { onNotReady: () => onProgress?.('node-starting') },
    );
  }

  private hydrateKeychain(
    session: Session,
    keychainResource: KeychainResource | undefined,
  ): Session {
    // A pointer means a keychain exists. Reading none is a failed read, not
    // absence, so sign-in fails instead of continuing with an empty shell.
    if (!keychainResource && session.keychainExternalIdentifier) {
      throw new KeychainHeadUnavailableError();
    }

    const keychain = keychainResource
      ? this.workspace.decryptKeychain(session, keychainResource)
      : emptyKeychain;

    return {
      ...session,
      keychain,
      keychainExternalIdentifier:
        keychainResource?.keychainExternalIdentifier ?? null,
    };
  }

  private applyRefreshedKeychain(
    session: Session,
    keychainResource: KeychainResource | undefined,
  ): Session {
    // A missing read does not prove the keychain is empty: it may predate a
    // publish that already added keys to this session.
    if (!keychainResource) {
      return session;
    }

    const keychain = this.workspace.decryptKeychain(session, keychainResource);

    // Keychain versions only move forward; an older read is stale in-flight.
    if (
      IdentitySnapshotSelection.selectKeychain(
        KeychainVersion.fromNumber(session.keychain.version),
        KeychainVersion.fromNumber(keychain.version),
      ) === 'held'
    ) {
      return session;
    }

    return {
      ...session,
      keychain,
      keychainExternalIdentifier: keychainResource.keychainExternalIdentifier,
    };
  }

  public async hydrate(
    session: Session,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<LoginResult> {
    onProgress?.('loading-keychain');
    const conversationsPromise = this.listConversations(session, onProgress);
    // Handle a failed list now so it cannot go unhandled while the keychain
    // loads; the await below still rethrows it.
    void conversationsPromise.catch(() => undefined);
    const keychainResource = await this.workspace.loadKeychain(session, {
      onNotReady: () => onProgress?.('node-starting'),
    });
    const hydratedSession = this.hydrateKeychain(session, keychainResource);

    onProgress?.('loading-workspace');

    const conversations = await conversationsPromise;

    return {
      conversations,
      session: hydratedSession,
    };
  }

  public async refresh(session: Session): Promise<LoginResult> {
    const keychainResource = await this.workspace.loadKeychain(session);
    const hydratedSession = this.applyRefreshedKeychain(
      session,
      keychainResource,
    );
    const conversations = await this.listConversations(hydratedSession);

    return {
      conversations,
      session: hydratedSession,
    };
  }
}
