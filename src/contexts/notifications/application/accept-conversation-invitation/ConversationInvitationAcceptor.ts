import type { Notification } from '../../domain/Notification';
import type { NotificationRepository } from '../../domain/repositories/NotificationRepository';
import type { InvitationKeyRecipient } from '../../domain/services/InvitationKeyRecipient';

import { NotificationDecision } from '../../domain/value-objects/NotificationDecision';
import { AcceptConversationInvitationMessage } from './messages/AcceptConversationInvitationMessage';

export class ConversationInvitationAcceptor {
  public constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly invitationKeyRecipient: InvitationKeyRecipient,
  ) {}

  public async accept(
    message: AcceptConversationInvitationMessage,
  ): Promise<Notification> {
    const recipientIdentityId = message.getRecipientIdentityId();
    const notification = await this.notificationRepository.find(
      message.getNotificationId(),
      recipientIdentityId,
    );

    await this.invitationKeyRecipient.receive(
      recipientIdentityId,
      message.getEncryptedInvitationKey(),
    );
    notification.decide(NotificationDecision.ACCEPTED, message.getOccurredAt());

    return await this.notificationRepository.save(
      notification,
      recipientIdentityId,
    );
  }
}
