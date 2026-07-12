import type {
  ConversationResource,
  KeychainResource,
  LocalKeychain,
  LoginResult,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { IdentityWorkspaceSessionPort } from '../../application/login-identity/IdentityWorkspaceSessionPort';
import type { LoginIdentityProgressReporter } from '../../application/login-identity/LoginIdentityProgressReporter';

const emptyKeychain: LocalKeychain = {
  conversations: {},
  version: 0,
};

export class PigeonIdentityWorkspaceSessionApi {
  public constructor(
    private readonly workspace: IdentityWorkspaceSessionPort,
  ) {}

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

  public async hydrate(
    session: Session,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<LoginResult> {
    onProgress?.('loading-keychain');
    const conversationsPromise = this.listConversations(session);
    const keychainResource = await this.workspace.loadKeychain(session);
    const hydratedSession = this.hydrateKeychain(session, keychainResource);

    onProgress?.('loading-workspace');

    return {
      conversations: await conversationsPromise,
      session: hydratedSession,
    };
  }

  public async refresh(session: Session): Promise<LoginResult> {
    const keychainResource = await this.workspace.loadKeychain(session);
    const hydratedSession = this.hydrateKeychain(session, keychainResource);
    const conversations = await this.listConversations(hydratedSession);

    return { conversations, session: hydratedSession };
  }
}
