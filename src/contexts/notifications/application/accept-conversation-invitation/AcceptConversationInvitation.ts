import type {
  LocalKeychain,
  NotificationResource,
} from '../../../../shared/domain/pigeonResources.types';
import type { UpdateNotificationPort } from '../ports/UpdateNotificationPort';
import type { ConversationInvitationKeychainPublisher } from './ConversationInvitationKeychainPublisher';
import type { ConversationInvitationKeyDecryptor } from './ConversationInvitationKeyDecryptor';

import { ConversationKeychain } from '../../../conversations/domain/ConversationKeychain';
import { NotificationDecision } from '../../domain/NotificationDecision';
import { NotificationId } from '../../domain/NotificationId';
import { AcceptConversationInvitationMessage } from './messages/AcceptConversationInvitationMessage';

export class AcceptConversationInvitation {
  public constructor(
    private readonly keyDecryptor: ConversationInvitationKeyDecryptor,
    private readonly keychainPublisher: ConversationInvitationKeychainPublisher,
    private readonly notifications: UpdateNotificationPort,
  ) {}

  public async accept(message: AcceptConversationInvitationMessage): Promise<{
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
    notification: NotificationResource;
  }> {
    const session = message.getSession();
    const notification = message.getNotification();

    if (notification.type === 'missed_call') {
      throw new Error('Missed call notifications cannot be accepted.');
    }

    const encryptedKey =
      notification.type === 'community_invitation'
        ? notification.payload.encryptedCommunityKey
        : notification.payload.encryptedConversationKey;
    const keyEntry = await this.keyDecryptor.decryptInvitationKey(
      session,
      encryptedKey,
    );
    const published = await this.keychainPublisher.publishKeychain(
      session,
      ConversationKeychain.withEntry(session.keychain, keyEntry),
    );
    const updated = await this.notifications.updateNotification(
      {
        ...session,
        keychain: published.keychain,
        keychainExternalIdentifier: published.keychainExternalIdentifier,
      },
      NotificationId.fromString(notification.id),
      NotificationDecision.accepted(),
    );

    return { ...published, notification: updated };
  }
}
