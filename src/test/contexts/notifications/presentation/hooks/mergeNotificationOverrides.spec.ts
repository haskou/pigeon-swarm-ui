import type { NotificationResource } from '../../../../../shared/domain/pigeonResources.types';

import { mergeNotificationOverrides } from '../../../../../contexts/notifications/presentation/hooks/mergeNotificationOverrides';

function notification(
  overrides: Partial<NotificationResource> = {},
): NotificationResource {
  return {
    createdAt: '2026-06-04T00:00:00.000Z',
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
    ...overrides,
  } as NotificationResource;
}

describe(mergeNotificationOverrides.name, () => {
  it('keeps accepted local notification state over a stale refresh', () => {
    const stale = notification({ state: 'pending' });
    const accepted = notification({ state: 'accepted', status: 'read' });
    const result = mergeNotificationOverrides(
      [stale],
      new Map([[accepted.id, accepted]]),
    );

    expect(result).toEqual([accepted]);
  });

  it('leaves unrelated notifications unchanged', () => {
    const stale = notification({ id: 'notification-1' });
    const accepted = notification({
      id: 'notification-2',
      state: 'accepted',
    });

    expect(
      mergeNotificationOverrides([stale], new Map([[accepted.id, accepted]])),
    ).toEqual([stale]);
  });
});
