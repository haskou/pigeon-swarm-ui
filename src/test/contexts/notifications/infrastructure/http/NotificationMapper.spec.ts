import type { NotificationResource } from '../../../../../contexts/notifications/infrastructure/http/resources/NotificationResource';

import { NotificationMapper } from '../../../../../contexts/notifications/infrastructure/http/NotificationMapper';

describe(NotificationMapper.name, () => {
  it('preserves the transport projection while applying domain state', () => {
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
      state: 'pending',
      status: 'unread',
      type: 'conversation_invitation',
    } satisfies NotificationResource;
    const mapper = new NotificationMapper();
    const notification = mapper.fromResource(resource);

    expect(mapper.toResource(notification)).toEqual(resource);
  });
});
