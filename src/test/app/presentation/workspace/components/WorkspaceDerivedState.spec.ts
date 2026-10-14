import type { CommunityResource as Community } from '../../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { ConversationResource } from '../../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { CommunityInvitationNotificationResource } from '../../../../../contexts/notifications/infrastructure/http/resources/CommunityInvitationNotificationResource';
import type { ConversationInvitationNotificationResource } from '../../../../../contexts/notifications/infrastructure/http/resources/ConversationInvitationNotificationResource';

import { WorkspaceDerivedState } from '../../../../../app/presentation/workspace/components/WorkspaceDerivedState';

function conversationInvite(): ConversationInvitationNotificationResource {
  return {
    id: 'notification-conversation',
    payload: {
      conversationId: 'conversation-a',
      encryptedConversationKey: 'encrypted-key',
      inviterIdentityId: 'identity-b',
      nonce: 'nonce-0123456789abcdef',
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
    id: 'notification-community',
    payload: {
      communityId: 'community-a',
      inviterIdentityId: 'identity-b',
      nonce: 'nonce-0123456789abcdef',
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

  it('treats a group as ready without a conversation key', () => {
    const group = { id: 'group', type: 'group' } as ConversationResource;
    const direct = {
      id: 'direct',
      type: 'one-to-one',
    } as ConversationResource;
    const key = { conversationId: 'direct' } as Parameters<
      typeof WorkspaceDerivedState.conversationReady
    >[1];

    expect(WorkspaceDerivedState.conversationReady(group, undefined)).toBe(
      true,
    );
    expect(WorkspaceDerivedState.conversationReady(direct, undefined)).toBe(
      false,
    );
    expect(WorkspaceDerivedState.conversationReady(direct, key)).toBe(true);
    expect(WorkspaceDerivedState.conversationReady(undefined, undefined)).toBe(
      false,
    );
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
