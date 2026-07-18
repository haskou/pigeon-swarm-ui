import { Timestamp } from '@haskou/value-objects';
import { mock } from 'jest-mock-extended';

import type { PigeonNotificationsGateway } from '../../../../../contexts/notifications/infrastructure/http/PigeonNotificationsGateway';
import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { NotificationDecision } from '../../../../../contexts/notifications/domain/value-objects/NotificationDecision';
import { NotificationRecipientId } from '../../../../../contexts/notifications/domain/value-objects/NotificationRecipientId';
import { NotificationAccessContexts } from '../../../../../contexts/notifications/infrastructure/http/NotificationAccessContexts';
import { NotificationMapper } from '../../../../../contexts/notifications/infrastructure/http/NotificationMapper';
import { PigeonNotificationRepository } from '../../../../../contexts/notifications/infrastructure/http/PigeonNotificationRepository';

describe(PigeonNotificationRepository.name, () => {
  it('persists the aggregate state through the HTTP gateway', async () => {
    const gateway = mock<PigeonNotificationsGateway>();
    const contexts = new NotificationAccessContexts();
    const session = {
      identity: { id: 'identity-1' },
    } as unknown as Session;
    contexts.register(session);
    const mapper = new NotificationMapper();
    const resource = {
      createdAt: '2026-01-01T00:00:00.000Z',
      id: 'notification-1',
      payload: {
        conversationId: 'conversation-1',
        encryptedConversationKey: 'encrypted-key',
        inviterIdentityId: 'identity-2',
        inviterSignature: 'signature',
        recipientIdentityId: 'identity-1',
      },
      recipientIdentityId: 'identity-1',
      state: 'pending' as const,
      status: 'unread' as const,
      type: 'conversation_invitation' as const,
    };
    const notification = mapper.fromResource(resource);
    notification.decide(NotificationDecision.DECLINED, new Timestamp(42));
    gateway.updateNotification.mockResolvedValue({
      ...resource,
      state: 'declined',
    });
    const repository = new PigeonNotificationRepository(
      gateway,
      contexts,
      mapper,
    );

    await repository.save(
      notification,
      NotificationRecipientId.fromString('identity-1'),
    );

    expect(gateway.updateNotification).toHaveBeenCalledWith(
      session,
      'notification-1',
      'declined',
    );
  });
});
