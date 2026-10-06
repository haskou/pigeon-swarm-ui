import type { NotificationResource } from '../../../../../shared/domain/pigeonResources.types';

import { notificationPreview } from '../../../../../contexts/notifications/presentation/view-models/notificationPreview';

function conversationInvitation(): NotificationResource {
  return {
    id: 'notification-1',
    payload: {
      conversationId: 'conversation-1',
      encryptedConversationKey: 'encrypted-key',
      inviterIdentityId: 'identity-1',
      nonce: 'nonce-0123456789abcdef',
      recipientIdentityId: 'identity-2',
    },
    recipientIdentityId: 'identity-2',
    state: 'pending',
    status: 'unread',
    type: 'conversation_invitation',
  };
}

describe(notificationPreview.name, () => {
  it('marks identity previews as loading while the identity is unresolved', () => {
    expect(
      notificationPreview(conversationInvitation(), {
        communities: [],
        communityAvatarUrls: {},
        communityPreviews: {},
        conversations: [],
        identityNames: {},
        identityPictures: {},
        identityProfiles: {},
      }),
    ).toMatchObject({
      loading: true,
    });
  });

  it('does not mark identity previews as loading when a cached name exists', () => {
    expect(
      notificationPreview(conversationInvitation(), {
        communities: [],
        communityAvatarUrls: {},
        communityPreviews: {},
        conversations: [],
        identityNames: { 'identity-1': 'Ada' },
        identityPictures: {},
        identityProfiles: {},
      }),
    ).toMatchObject({
      loading: false,
      title: 'Ada',
    });
  });
});
