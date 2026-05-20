import type {
  LocalKeychain,
  NotificationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface AcceptConversationInvitationPort {
  acceptConversationInvitation(
    session: Session,
    notification: NotificationResource,
  ): Promise<{
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
    notification: NotificationResource;
  }>;
}
