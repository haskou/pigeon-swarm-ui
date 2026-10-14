import type { ForgetCurrentDeviceOutcome } from '../../../contexts/identities/application/forget-current-device/ForgetCurrentDeviceOutcome';
import type { LoginIdentityProgressReporter } from '../../../contexts/identities/application/login-identity/LoginIdentityProgressReporter';
import type { DevicePairingRequestDraft } from '../../../contexts/identities/domain/DevicePairingRequestDraft';
import type { DeviceAuthorizationRevision } from '../../../contexts/identities/domain/value-objects/DeviceAuthorizationRevision';
import type { DeviceCredential } from '../../../contexts/identities/domain/value-objects/DeviceCredential';
import type { IdentityAccessContexts } from '../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import type { IdentityAdmissionProgressListener } from '../../../contexts/identities/infrastructure/http/IdentityAdmissionProgressListener';
import type { IdentityMapper } from '../../../contexts/identities/infrastructure/http/IdentityMapper';
import type { IdentityPresenceMapper } from '../../../contexts/identities/infrastructure/http/IdentityPresenceMapper';
import type { PigeonIdentitiesGateway } from '../../../contexts/identities/infrastructure/http/PigeonIdentitiesGateway';
import type { IdentityPresenceResource as IdentityPresence } from '../../../contexts/identities/infrastructure/http/resources/IdentityPresenceResource';
import type { IdentityResource } from '../../../contexts/identities/infrastructure/http/resources/IdentityResource';
import type { IdentityUpdateProfileInput } from '../../../contexts/identities/infrastructure/http/resources/IdentityUpdateProfileInput';
import type { LoginResult } from '../../../contexts/identities/infrastructure/http/resources/LoginResult';
import type { PresenceStatusResource } from '../../../contexts/identities/infrastructure/http/resources/PresenceStatusResource';
import type { SelectablePresenceStatusResource as SelectablePresenceStatus } from '../../../contexts/identities/infrastructure/http/resources/SelectablePresenceStatusResource';
import type {
  LocalKeychain,
  LocalKeychainUpdate,
} from '../../../contexts/identities/infrastructure/keychain/LocalKeychain';
import type { Session } from '../../../contexts/identities/infrastructure/session/Session';
import type { ContactDirectoryEntry } from '../../../contexts/identities/infrastructure/storage/ContactDirectoryEntry';
import type { ContactDirectoryStore } from '../../../contexts/identities/infrastructure/storage/ContactDirectoryStore';
import type { DeviceUnlockMethod } from '../../../contexts/identities/infrastructure/storage/DeviceUnlockMethod';
import type { ContactPresenceStorage } from './ContactPresenceStorage';
import type { IdentityUseCases } from './IdentityUseCases';

import { ConversationTimeline } from '../../../contexts/conversations/presentation/view-models/ConversationTimeline';
import { FindIdentityPresenceMessage } from '../../../contexts/identities/application/find-identity-presence/messages/FindIdentityPresenceMessage';
import { FindIdentityMessage } from '../../../contexts/identities/application/find-identity/messages/FindIdentityMessage';
import { ForgetCurrentDeviceMessage } from '../../../contexts/identities/application/forget-current-device/messages/ForgetCurrentDeviceMessage';
import { ForgetDeviceUnlockMessage } from '../../../contexts/identities/application/forget-device-unlock/messages/ForgetDeviceUnlockMessage';
import { LoginIdentityMessage } from '../../../contexts/identities/application/login-identity/messages/LoginIdentityMessage';
import { PublishContactPresenceMessage } from '../../../contexts/identities/application/publish-contact-presence/messages/PublishContactPresenceMessage';
import { ReceiveContactPresencesMessage } from '../../../contexts/identities/application/receive-contact-presences/messages/ReceiveContactPresencesMessage';
import { RefreshIdentityMessage } from '../../../contexts/identities/application/refresh-identity/messages/RefreshIdentityMessage';
import { RegisterIdentityMessage } from '../../../contexts/identities/application/register-identity/messages/RegisterIdentityMessage';
import { SearchContactPresencesMessage } from '../../../contexts/identities/application/search-contact-presences/messages/SearchContactPresencesMessage';
import { SearchPresenceSharingsMessage } from '../../../contexts/identities/application/search-presence-sharings/messages/SearchPresenceSharingsMessage';
import { ShareContactPresenceMessage } from '../../../contexts/identities/application/share-contact-presence/messages/ShareContactPresenceMessage';
import { StopSharingContactPresenceMessage } from '../../../contexts/identities/application/stop-sharing-contact-presence/messages/StopSharingContactPresenceMessage';
import { UpdateIdentityPresenceMessage } from '../../../contexts/identities/application/update-identity-presence/messages/UpdateIdentityPresenceMessage';
import { UpdateIdentityProfileMessage } from '../../../contexts/identities/application/update-identity-profile/messages/UpdateIdentityProfileMessage';
import { DevicePairingCode } from '../../../contexts/identities/domain/value-objects/DevicePairingCode';
import { IdentityId } from '../../../contexts/identities/domain/value-objects/IdentityId';
import { IdentityPassword } from '../../../contexts/identities/domain/value-objects/IdentityPassword';

export class PigeonIdentitiesFacade {
  public constructor(
    private readonly gateway: PigeonIdentitiesGateway,
    private readonly contexts: IdentityAccessContexts,
    private readonly mapper: IdentityMapper,
    private readonly presenceMapper: IdentityPresenceMapper,
    private readonly useCases: IdentityUseCases,
    private readonly contactDirectory: ContactDirectoryStore,
    private readonly contactPresence: ContactPresenceStorage,
  ) {}

  private hydrateLoginResult(result: LoginResult): LoginResult {
    return {
      ...result,
      conversations: ConversationTimeline.sortByLatestMessage(
        result.conversations,
      ),
    };
  }

  public async changePassword(
    session: Session,
    currentPassword: string,
    nextPassword: string,
  ): Promise<void> {
    await this.gateway.changePassword(session, currentPassword, nextPassword);
  }

  /** Switches this device back to a password; the passkey confirms it. */
  public async disablePasskeyUnlock(
    session: Session,
    nextPassword: string,
  ): Promise<void> {
    await this.gateway.disablePasskeyUnlock(session, nextPassword);
  }

  /** Asks for the device password or passkey again; changes nothing. */
  public async confirmLocalUnlock(
    identityId: string,
    password?: string,
  ): Promise<void> {
    await this.gateway.confirmLocalUnlock(identityId, password);
  }

  /** Replaces this device's password unlock with a user-verified passkey. */
  public async enablePasskeyUnlock(
    session: Session,
    currentPassword: string,
  ): Promise<void> {
    await this.gateway.enablePasskeyUnlock(session, currentPassword);
  }

  public async localUnlockMethod(
    identityId: string,
  ): Promise<DeviceUnlockMethod | undefined> {
    return await this.gateway.localUnlockMethod(identityId);
  }

  public async passkeyUnlockSupported(): Promise<boolean> {
    return await this.gateway.passkeyUnlockSupported();
  }

  public createDevicePairingInvitation(session: Session): DevicePairingCode {
    return this.gateway.createDevicePairingInvitation(session);
  }

  public async createDevicePairingRequest(
    invitationCode: DevicePairingCode,
  ): Promise<DevicePairingRequestDraft> {
    return await this.gateway.createDevicePairingRequest(invitationCode);
  }

  public async verifyDevicePairingRequest(
    requestCode: DevicePairingCode,
  ): Promise<string> {
    return await this.gateway.verifyDevicePairingRequest(requestCode);
  }

  /**
   * Hands the identity root to a new device once the password, or the
   * passkey when it unlocks this device, is confirmed again.
   */
  public async authorizeDevicePairing(
    session: Session,
    requestCode: DevicePairingCode,
    password?: string,
  ): Promise<{ completionCode: DevicePairingCode; session: Session }> {
    return await this.gateway.authorizeDevicePairing(
      session,
      requestCode,
      password,
    );
  }

  public async listDevices(session: Session): Promise<DeviceCredential[]> {
    return await this.gateway.listDevices(session);
  }

  /**
   * Replays the signed device transitions against the local checkpoint:
   * resolves the advanced session, or throws DeviceRemovedError on a verified
   * removal of this device.
   */
  public async synchronizeDeviceAuthorization(
    session: Session,
  ): Promise<Session> {
    return await this.gateway.synchronizeDeviceAuthorization(session);
  }

  public async deviceSealedRootGeneration(
    session: Session,
  ): Promise<number | null> {
    return await this.gateway.deviceSealedRootGeneration(session);
  }

  public async revokeDevice(
    session: Session,
    target: DeviceCredential,
    compromisedSince?: DeviceAuthorizationRevision,
  ): Promise<Session> {
    return await this.gateway.revokeDevice(session, target, compromisedSince);
  }

  /**
   * Retires this device's credential, then wipes its local direct state and
   * unlock. The only device is kept until `allowOnlyDevice` confirms it.
   */
  public async forgetCurrentDevice(
    session: Session,
    allowOnlyDevice: boolean,
  ): Promise<ForgetCurrentDeviceOutcome> {
    this.contexts.register(session);

    return await this.useCases.currentDeviceForgetter.forget(
      new ForgetCurrentDeviceMessage(session.identity.id, allowOnlyDevice),
    );
  }

  public discardDeviceSealedRecovery(identityId: string): void {
    this.gateway.discardDeviceSealedRecovery(identityId);
  }

  public async completeDevicePairing(
    identityId: string,
    password: string,
    draft: DevicePairingRequestDraft,
    completionCode: DevicePairingCode,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<LoginResult> {
    return this.hydrateLoginResult(
      await this.gateway.completeDevicePairing(
        identityId,
        IdentityPassword.fromString(password),
        draft,
        completionCode,
        onProgress,
      ),
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

  /**
   * The presence of each contact this identity shares presence with, as
   * last received; `disconnected` once an update expired.
   */
  public async getContactPresences(
    session: Session,
  ): Promise<IdentityPresence[]> {
    this.contexts.register(session);

    return (
      await this.useCases.contactPresencesSearcher.search(
        new SearchContactPresencesMessage(session.identity.id, Date.now()),
      )
    ).map((presence) => this.presenceMapper.toResource(presence));
  }

  /** Contacts this device shares presence with, by direct conversation. */
  public async getPresenceSharings(
    session: Session,
  ): Promise<{ contactIdentityId: string; conversationId: string }[]> {
    this.contexts.register(session);

    return (
      await this.useCases.presenceSharingsSearcher.search(
        new SearchPresenceSharingsMessage(session.identity.id),
      )
    ).map((sharing) => sharing.toPrimitives());
  }

  public async login(
    identityId: string,
    password: string,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<LoginResult> {
    const message = new LoginIdentityMessage({
      identityId,
      password,
    });

    this.contexts.registerProgress(identityId, onProgress);
    const identity = await this.useCases.login.login(message);

    return this.hydrateLoginResult(
      await this.gateway.hydrateSession(
        this.contexts.findFor(identity).session,
        onProgress,
      ),
    );
  }

  /** The passkey output stays inside composition; the UI never sees it. */
  public async loginWithPasskey(
    identityId: string,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<LoginResult> {
    return await this.login(
      identityId,
      await this.gateway.passkeyUnlockSecret(identityId),
      onProgress,
    );
  }

  public async publishKeychain(
    session: Session,
    update: LocalKeychainUpdate,
  ): Promise<{ keychain: LocalKeychain; keychainExternalIdentifier: string }> {
    return await this.gateway.publishKeychain(session, update);
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

  public async recover(
    identityId: string,
    password: string,
    recoveryKey: string,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<LoginResult> {
    return this.hydrateLoginResult(
      await this.gateway.recover(identityId, password, recoveryKey, onProgress),
    );
  }

  public async register(
    name: string,
    password: string,
    networks: string[],
    handle?: string,
    options: { recoveryKey?: string } = {},
  ): Promise<LoginResult> {
    const identity = await this.useCases.register.register(
      new RegisterIdentityMessage({
        handle,
        name,
        networks,
        occurredAt: Date.now(),
        password,
        recoveryKey: options.recoveryKey,
      }),
    );
    const identityId = IdentityId.fromString(identity.toPrimitives().id);

    return this.hydrateLoginResult(
      await this.gateway.hydrateSession(this.contexts.find(identityId).session),
    );
  }

  /** The sealed contact directory of the session's identity. */
  public async knownContacts(
    session: Session,
  ): Promise<readonly ContactDirectoryEntry[]> {
    return await this.contactDirectory.contacts(session);
  }

  public async rememberContacts(
    session: Session,
    contacts: readonly ContactDirectoryEntry[],
  ): Promise<void> {
    await this.contactDirectory.replace(session, contacts);
  }

  /** Never throws. */
  public async forgetContacts(identityId: string): Promise<void> {
    await this.contactDirectory.forget(identityId);
  }

  public async forgetDeviceUnlock(identityId: string): Promise<void> {
    await this.useCases.deviceUnlockForgetter.forget(
      new ForgetDeviceUnlockMessage(identityId),
    );
  }

  /**
   * Drops this device's presence sharings of the identity and the contact
   * presence held for it, as when the device was removed.
   */
  public async forgetContactPresence(identityId: string): Promise<void> {
    this.contactPresence.inboxes.forget(identityId);
    await this.contactPresence.sharings.forget(identityId);
  }

  /**
   * After a revoke rotated the sealed root, leaves it the only reader of the
   * identity's presence inboxes. Rejects when an inbox was not cut off.
   */
  public async cutOffRevokedPresenceReaders(session: Session): Promise<void> {
    this.contexts.register(session);
    await this.contactPresence.inboxes.cutOffRevokedReaders(session);
  }

  /** Drops contact presence and sharing keys held in memory, for logout. */
  public disposeContactPresence(): void {
    this.contactPresence.inboxes.dispose();
    this.contactPresence.sharings.close();
  }

  /**
   * Sends this identity's status to every contact it shares presence with,
   * when due; invisible and disconnected send nothing. Never rejects on a
   * relay failure.
   */
  public async publishContactPresence(
    session: Session,
    status: PresenceStatusResource,
  ): Promise<void> {
    this.contexts.register(session);
    await this.useCases.contactPresencePublisher.publish(
      new PublishContactPresenceMessage(
        session.identity.id,
        status,
        Date.now(),
      ),
    );
  }

  /** Reads the contacts' presence inboxes, then reports every contact. */
  public async receiveContactPresences(
    session: Session,
  ): Promise<IdentityPresence[]> {
    this.contexts.register(session);

    return (
      await this.useCases.contactPresencesReceiver.receive(
        new ReceiveContactPresencesMessage(session.identity.id, Date.now()),
      )
    ).map((presence) => this.presenceMapper.toResource(presence));
  }

  /** Starts exchanging presence with the peer of a direct conversation. */
  public async shareContactPresence(
    session: Session,
    conversationId: string,
    contactIdentityId: string,
  ): Promise<void> {
    this.contexts.register(session);
    await this.useCases.contactPresenceSharer.share(
      new ShareContactPresenceMessage(
        session.identity.id,
        conversationId,
        contactIdentityId,
      ),
    );
  }

  /** Stops the exchange and deletes this identity's inbox for the contact. */
  public async stopSharingContactPresence(
    session: Session,
    conversationId: string,
    contactIdentityId: string,
  ): Promise<void> {
    this.contexts.register(session);
    await this.useCases.contactPresenceSharingStopper.stop(
      new StopSharingContactPresenceMessage(
        session.identity.id,
        conversationId,
        contactIdentityId,
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

  /** Reports re-mining while a busy node asks for a stronger proof. */
  public watchAdmissionProgress(
    listener: IdentityAdmissionProgressListener,
  ): () => void {
    return this.gateway.watchAdmissionProgress(listener);
  }
}
