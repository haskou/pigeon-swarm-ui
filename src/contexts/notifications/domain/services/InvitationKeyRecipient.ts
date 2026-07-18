import type { EncryptedInvitationKey } from '../value-objects/EncryptedInvitationKey';
import type { NotificationRecipientId } from '../value-objects/NotificationRecipientId';

export interface InvitationKeyRecipient {
  receive(
    recipientIdentityId: NotificationRecipientId,
    encryptedInvitationKey: EncryptedInvitationKey,
  ): Promise<void>;
}
