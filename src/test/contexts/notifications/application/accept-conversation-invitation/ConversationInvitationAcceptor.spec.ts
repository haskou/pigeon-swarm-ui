import { mock } from 'jest-mock-extended';

import type { NotificationRepository } from '../../../../../contexts/notifications/domain/repositories/NotificationRepository';
import type { InvitationKeyRecipient } from '../../../../../contexts/notifications/domain/services/InvitationKeyRecipient';

import { ConversationInvitationAcceptor } from '../../../../../contexts/notifications/application/accept-conversation-invitation/ConversationInvitationAcceptor';
import { AcceptConversationInvitationMessage } from '../../../../../contexts/notifications/application/accept-conversation-invitation/messages/AcceptConversationInvitationMessage';
import { Notification } from '../../../../../contexts/notifications/domain/Notification';

describe(ConversationInvitationAcceptor.name, () => {
  it('receives the key before accepting and persisting the invitation', async () => {
    const repository = mock<NotificationRepository>();
    const recipient = mock<InvitationKeyRecipient>();
    const notification = Notification.fromPrimitives({
      id: 'notification-1',
      recipientIdentityId: 'identity-1',
      state: 'pending',
      type: 'conversation_invitation',
    });
    repository.find.mockResolvedValue(notification);
    repository.save.mockResolvedValue(notification);
    const acceptor = new ConversationInvitationAcceptor(repository, recipient);

    await expect(
      acceptor.accept(
        new AcceptConversationInvitationMessage(
          'notification-1',
          'identity-1',
          'encrypted-key',
          42,
        ),
      ),
    ).resolves.toBe(notification);
    expect(recipient.receive).toHaveBeenCalled();
    expect(notification.toPrimitives().state).toBe('accepted');
    expect(repository.save).toHaveBeenCalled();
  });
});
