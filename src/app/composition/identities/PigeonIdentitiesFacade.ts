import type { LoginIdentityProgressReporter } from '../../../contexts/identities/application/login-identity/LoginIdentityProgressReporter';
import type { IdentityAccessContexts } from '../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import type { IdentityMapper } from '../../../contexts/identities/infrastructure/http/IdentityMapper';
import type { IdentityPresenceMapper } from '../../../contexts/identities/infrastructure/http/IdentityPresenceMapper';
import type { PigeonIdentitiesGateway } from '../../../contexts/identities/infrastructure/http/PigeonIdentitiesGateway';
import type { IdentityUpdateProfileInput } from '../../../contexts/identities/infrastructure/http/resources/IdentityUpdateProfileInput';
import type {
  IdentityPresence,
  IdentityResource,
  LocalKeychain,
  LoginResult,
  Session,
  SelectablePresenceStatus,
} from '../../../shared/domain/pigeonResources.types';
import type { IdentityUseCases } from './IdentityUseCases';

import { ConversationTimeline } from '../../../contexts/conversations/presentation/view-models/ConversationTimeline';
import { FindIdentityPresenceMessage } from '../../../contexts/identities/application/find-identity-presence/messages/FindIdentityPresenceMessage';
import { FindIdentityMessage } from '../../../contexts/identities/application/find-identity/messages/FindIdentityMessage';
import { LoginIdentityMessage } from '../../../contexts/identities/application/login-identity/messages/LoginIdentityMessage';
import { RefreshIdentityMessage } from '../../../contexts/identities/application/refresh-identity/messages/RefreshIdentityMessage';
import { RegisterIdentityMessage } from '../../../contexts/identities/application/register-identity/messages/RegisterIdentityMessage';
import { RestoreRememberedIdentityMessage } from '../../../contexts/identities/application/restore-remembered-identity/messages/RestoreRememberedIdentityMessage';
import { SearchIdentityPresencesMessage } from '../../../contexts/identities/application/search-identity-presences/messages/SearchIdentityPresencesMessage';
import { UpdateIdentityPresenceMessage } from '../../../contexts/identities/application/update-identity-presence/messages/UpdateIdentityPresenceMessage';
import { UpdateIdentityProfileMessage } from '../../../contexts/identities/application/update-identity-profile/messages/UpdateIdentityProfileMessage';
import { IdentityId } from '../../../contexts/identities/domain/value-objects/IdentityId';

export class PigeonIdentitiesFacade {
  public constructor(
    private readonly gateway: PigeonIdentitiesGateway,
    private readonly contexts: IdentityAccessContexts,
    private readonly mapper: IdentityMapper,
    private readonly presenceMapper: IdentityPresenceMapper,
    private readonly useCases: IdentityUseCases,
  ) {}

  private hydrateLoginResult(result: LoginResult): LoginResult {
    return {
      ...result,
      conversations: ConversationTimeline.sortByLatestMessage(
        result.conversations,
      ),
    };
  }

  public async configureLocalPasskeyUnlock(
    session: Session,
    password: string,
    enabled: boolean,
    recoveryKey?: string,
  ): Promise<void> {
    await this.gateway.configureLocalPasskeyUnlock(
      session,
      password,
      enabled,
      recoveryKey,
    );
  }

  public async get(identityId: string): Promise<IdentityResource> {
    const identity = await this.useCases.finder.find(
      new FindIdentityMessage(identityId),
    );

    return this.mapper.toResource(
      identity,
      await this.gateway.getIdentity(identityId),
    );
  }

  public async getPresence(
    session: Session,
    identityId: string,
  ): Promise<IdentityPresence> {
    this.contexts.register(session);

    return this.presenceMapper.toResource(
      await this.useCases.presenceFinder.find(
        new FindIdentityPresenceMessage(identityId, session.identity.id),
      ),
    );
  }

  public async getPresences(
    session: Session,
    identityIds: string[],
  ): Promise<IdentityPresence[]> {
    this.contexts.register(session);

    return (
      await this.useCases.presenceSearcher.search(
        new SearchIdentityPresencesMessage(identityIds, session.identity.id),
      )
    ).map((presence) => this.presenceMapper.toResource(presence));
  }

  public async login(
    identityId: string,
    password: string,
    onProgress?: LoginIdentityProgressReporter,
    recoveryKey?: string,
  ): Promise<LoginResult> {
    const message = new LoginIdentityMessage({
      identityId,
      password,
      recoveryKey,
    });

    this.contexts.registerProgress(identityId, onProgress);
    await this.useCases.login.login(message);

    return this.hydrateLoginResult(
      await this.gateway.hydrateSession(
        this.contexts.find(message.getIdentityId()).session,
        onProgress,
      ),
    );
  }

  public async publishKeychain(
    session: Session,
    nextKeychain: LocalKeychain,
  ): Promise<{ keychain: LocalKeychain; keychainExternalIdentifier: string }> {
    return await this.gateway.publishKeychain(session, nextKeychain);
  }

  public async refresh(identityId: string): Promise<IdentityResource> {
    const identity = await this.useCases.refresher.refresh(
      new RefreshIdentityMessage(identityId),
    );

    return this.mapper.toResource(
      identity,
      await this.gateway.getIdentity(identityId),
    );
  }

  public async register(
    name: string,
    password: string,
    networks: string[],
    handle?: string,
    options: { passkeyPrfEnabled?: boolean; recoveryKey?: string } = {},
  ): Promise<LoginResult> {
    const identity = await this.useCases.register.register(
      new RegisterIdentityMessage({
        handle,
        name,
        networks,
        occurredAt: Date.now(),
        passkeyPrfEnabled: options.passkeyPrfEnabled,
        password,
        recoveryKey: options.recoveryKey,
      }),
    );
    const identityId = IdentityId.fromString(identity.toPrimitives().id);

    return this.hydrateLoginResult(
      await this.gateway.hydrateSession(this.contexts.find(identityId).session),
    );
  }

  public async restoreRemembered(
    identityId: string,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<LoginResult> {
    const message = new RestoreRememberedIdentityMessage(identityId);

    this.contexts.registerProgress(identityId, onProgress);
    await this.useCases.rememberedIdentityRestorer.restore(message);

    return this.hydrateLoginResult(
      await this.gateway.hydrateSession(
        this.contexts.find(message.getIdentityId()).session,
        onProgress,
      ),
    );
  }

  public async updatePresence(
    session: Session,
    status: SelectablePresenceStatus,
  ): Promise<IdentityPresence> {
    this.contexts.register(session);

    return this.presenceMapper.toResource(
      await this.useCases.presenceUpdater.update(
        new UpdateIdentityPresenceMessage(
          session.identity.id,
          status,
          Date.now(),
        ),
      ),
    );
  }

  public async updateProfile(
    session: Session,
    profile: IdentityUpdateProfileInput,
    newPassword?: string,
    options: {
      currentPassword?: string;
      passkeyPrfEnabled?: boolean;
      recoveryKey?: string;
    } = {},
  ): Promise<IdentityResource> {
    this.contexts.register(session, newPassword, options);
    const identity = await this.useCases.profileUpdater.update(
      new UpdateIdentityProfileMessage({
        actorIdentityId: session.identity.id,
        banner: profile.banner,
        biography: profile.biography,
        handle: profile.handle,
        name: profile.name,
        networkIds: profile.networks ?? session.identity.networks,
        occurredAt: Date.now(),
        picture: profile.picture,
      }),
    );

    return this.mapper.toResource(
      identity,
      await this.gateway.getIdentity(session.identity.id),
    );
  }
}
