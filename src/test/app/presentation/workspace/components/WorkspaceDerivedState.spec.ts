import type {
  Community,
  CommunityInvitationNotificationResource,
  ConversationInvitationNotificationResource,
  ConversationResource,
} from '../../../../../shared/domain/pigeonResources.types';

import { WorkspaceDerivedState } from '../../../../../app/presentation/workspace/components/WorkspaceDerivedState';

function conversationInvite(): ConversationInvitationNotificationResource {
  return {
    createdAt: '2026-07-19T00:00:00.000Z',
    id: 'notification-conversation',
    payload: {
      conversationId: 'conversation-a',
      encryptedConversationKey: 'encrypted-key',
      inviterIdentityId: 'identity-b',
      inviterSignature: 'signature',
      recipientIdentityId: 'identity-a',
    },
    recipientIdentityId: 'identity-a',
    state: 'pending',
    status: 'unread',
    type: 'conversation_invitation',
  };
}

function communityInvite(): CommunityInvitationNotificationResource {
  return {
    createdAt: '2026-07-19T00:00:00.000Z',
    id: 'notification-community',
    payload: {
      communityId: 'community-a',
      encryptedCommunityKey: 'encrypted-key',
      inviterIdentityId: 'identity-b',
      inviterSignature: 'signature',
      recipientIdentityId: 'identity-a',
    },
    recipientIdentityId: 'identity-a',
    state: 'pending',
    status: 'unread',
    type: 'community_invitation',
  };
}

describe('WorkspaceDerivedState', () => {
  const conversations = [
    { id: 'conversation-a' },
    { id: 'conversation-b' },
  ] as ConversationResource[];

  it('selects the requested conversation and falls back to the first one', () => {
    expect(
      WorkspaceDerivedState.activeConversation(conversations, 'conversation-b'),
    ).toBe(conversations[1]);
    expect(
      WorkspaceDerivedState.activeConversation(conversations, 'missing'),
    ).toBe(conversations[0]);
  });

  it('finds pending invitations only for the active recipient and scope', () => {
    const conversationInvitation = conversationInvite();
    const communityInvitation = communityInvite();

    expect(
      WorkspaceDerivedState.pendingConversationInvitation(
        [conversationInvitation, communityInvitation],
        conversations[0],
        'identity-a',
      ),
    ).toBe(conversationInvitation);
    expect(
      WorkspaceDerivedState.pendingCommunityInvitation(
        [conversationInvitation, communityInvitation],
        { id: 'community-a' } as Community,
        'identity-a',
      ),
    ).toBe(communityInvitation);
  });

  it('derives dialog and push prompt visibility without leaking conditions', () => {
    expect(WorkspaceDerivedState.hasOpenDialog([false, true, false])).toBe(
      true,
    );
    expect(
      WorkspaceDerivedState.pushPromptVisible(true, 'default', false),
    ).toBe(true);
    expect(
      WorkspaceDerivedState.pushPromptVisible(true, 'granted', false),
    ).toBe(false);
  });

  it('keeps the rail community selection scoped to community mode', () => {
    const community = { id: 'community-a' } as Community;

    expect(WorkspaceDerivedState.railCommunityId('community', community)).toBe(
      'community-a',
    );
    expect(WorkspaceDerivedState.railCommunityId('messages', community)).toBe(
      null,
    );
  });
});
