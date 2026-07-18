import { NotificationRecipientId } from '../../../domain/value-objects/NotificationRecipientId';

export class SearchNotificationsMessage {
  public constructor(private readonly recipientIdentityId: string) {}

  public getRecipientIdentityId(): NotificationRecipientId {
    return NotificationRecipientId.fromString(this.recipientIdentityId);
  }
}
