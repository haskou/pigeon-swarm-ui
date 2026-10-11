import type {
  ConversationResource,
  KeychainResource,
  LocalKeychain,
  LoginResult,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { LoginIdentityProgressReporter } from '../../application/login-identity/LoginIdentityProgressReporter';
import type { IdentityWorkspaceSource } from './IdentityWorkspaceSource';

const emptyKeychain: LocalKeychain = {
  conversations: {},
  version: 0,
};

export class PigeonIdentityWorkspaceSessionApi {
  public constructor(private readonly workspace: IdentityWorkspaceSource) {}

  private async listConversations(
    session: Session,
  ): Promise<ConversationResource[]> {
    return await this.workspace.listConversations(session).catch(() => []);
  }

  private hydrateKeychain(
    session: Session,
    keychainResource: KeychainResource | undefined,
  ): Session {
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
    if (keychain.version < session.keychain.version) {
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
    const conversationsPromise = this.listConversations(session);
    const keychainResource = await this.workspace.loadKeychain(session);
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
