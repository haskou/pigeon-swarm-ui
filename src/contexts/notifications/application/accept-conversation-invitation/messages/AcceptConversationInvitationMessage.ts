import { Timestamp } from '@haskou/value-objects';

import { EncryptedInvitationKey } from '../../../domain/value-objects/EncryptedInvitationKey';
import { NotificationId } from '../../../domain/value-objects/NotificationId';
import { NotificationRecipientId } from '../../../domain/value-objects/NotificationRecipientId';

export class AcceptConversationInvitationMessage {
  public constructor(
    private readonly notificationId: string,
    private readonly recipientIdentityId: string,
    private readonly encryptedInvitationKey: string,
    private readonly occurredAt: number,
  ) {}

  public getEncryptedInvitationKey(): EncryptedInvitationKey {
    return EncryptedInvitationKey.fromString(this.encryptedInvitationKey);
  }

  public getNotificationId(): NotificationId {
    return NotificationId.fromString(this.notificationId);
  }

  public getOccurredAt(): Timestamp {
    return new Timestamp(this.occurredAt);
  }

  public getRecipientIdentityId(): NotificationRecipientId {
    return NotificationRecipientId.fromString(this.recipientIdentityId);
  }
}
