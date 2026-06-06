import type { NotificationResource } from '../../../../shared/domain/pigeonResources.types';

import { Notification } from './Notification';

describe(Notification.name, () => {
  const pendingInvitation = {
    createdAt: '2026-01-01T00:00:00.000Z',
    id: 'notification-1',
    payload: {
      conversationId: 'conversation-1',
      encryptedConversationKey: 'key',
      inviterIdentityId: 'identity-1',
      inviterSignature: 'signature',
      recipientIdentityId: 'identity-2',
    },
    recipientIdentityId: 'identity-2',
    state: 'pending',
    status: 'unread',
    type: 'conversation_invitation',
  } satisfies NotificationResource;

  it('accepts pending invitations and records a domain event', () => {
    const notification = Notification.fromResource(pendingInvitation);

    notification.accept();

    expect(notification.getState().isAccepted()).toBe(true);
    expect(notification.pullDomainEvents()).toEqual([
      expect.objectContaining({ type: 'NotificationAccepted' }),
    ]);
  });

  it('rejects missed calls as respondable invitations', () => {
    const notification = Notification.fromResource({
      ...pendingInvitation,
      payload: {
        callerIdentityId: 'identity-1',
        callId: 'call-1',
        networkId: 'network-1',
        recipientIdentityId: 'identity-2',
      },
      type: 'missed_call',
    });

    expect(() => notification.accept()).toThrow(
      'Notification cannot be answered.',
    );
  });
});
