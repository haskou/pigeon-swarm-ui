import type {
  LocalKeychain,
  NotificationResource,
  Session,
} from '../../../../domain/types';

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
