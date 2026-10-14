import type { CommunityMembershipRequestResource } from '../../../../../contexts/communities/infrastructure/http/resources/CommunityMembershipRequestResource';
import type { CommunityResource } from '../../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { NotificationResource } from '../../../../../contexts/notifications/infrastructure/http/resources/NotificationResource';

import {
  canActOnMembershipRequest,
  isPendingCommunityInvitationFor,
  isPendingConversationInvitationFor,
} from '../../../../../app/presentation/workspace/components/workspaceNotificationState';

const OWN_ID = 'MCowBQYDK2VwAyEAown';
const OTHER_ID = 'MCowBQYDK2VwAyEAother';
const PEM_OWN_ID = `-----BEGIN PUBLIC KEY-----\n${OWN_ID}\n-----END PUBLIC KEY-----\n`;

const community = (ownerIdentityId: string): CommunityResource => ({
  createdAt: 0,
  description: '',
  id: 'community-1',
  memberIds: [ownerIdentityId],
  name: 'Community',
  networkId: 'network-1',
  ownerIdentityId,
  textChannels: [],
  visibility: 'private',
});
const request = (
  overrides: Partial<CommunityMembershipRequestResource>,
): CommunityMembershipRequestResource => ({
  communityId: 'community-1',
  createdAt: 0,
  creatorIdentityId: OTHER_ID,
  id: 'request-1',
  identityId: OTHER_ID,
  status: 'pending',
  type: 'request',
  updatedAt: 0,
  ...overrides,
});
const conversationInvitation: NotificationResource = {
  id: 'notification-1',
  payload: {
    conversationId: 'conversation-1',
    encryptedConversationKey: 'key',
    inviterIdentityId: OTHER_ID,
    nonce: 'nonce',
    recipientIdentityId: PEM_OWN_ID,
  },
  recipientIdentityId: PEM_OWN_ID,
  state: 'pending',
  status: 'unread',
  type: 'conversation_invitation',
};
const communityInvitation: NotificationResource = {
  id: 'notification-2',
  payload: {
    communityId: 'community-1',
    inviterIdentityId: OTHER_ID,
    nonce: 'nonce',
    recipientIdentityId: PEM_OWN_ID,
  },
  recipientIdentityId: PEM_OWN_ID,
  state: 'pending',
  status: 'unread',
  type: 'community_invitation',
};

describe(canActOnMembershipRequest.name, () => {
  it('lets the invited identity act on an invitation addressed in PEM form', () => {
    expect(
      canActOnMembershipRequest(
        request({ identityId: PEM_OWN_ID, type: 'invitation' }),
        [],
        OWN_ID,
      ),
    ).toBe(true);
  });

  it('lets the owner stored in PEM form act on a join request', () => {
    expect(
      canActOnMembershipRequest(request({}), [community(PEM_OWN_ID)], OWN_ID),
    ).toBe(true);
  });

  it('refuses another identity and a rejected id', () => {
    expect(
      canActOnMembershipRequest(request({}), [community(OTHER_ID)], OWN_ID),
    ).toBe(false);
    expect(
      canActOnMembershipRequest(
        request({ identityId: 'x'.repeat(5000), type: 'invitation' }),
        [],
        'x'.repeat(5000),
      ),
    ).toBe(false);
  });
});

describe(isPendingConversationInvitationFor.name, () => {
  it('matches the recipient addressed in PEM form', () => {
    expect(
      isPendingConversationInvitationFor(
        conversationInvitation,
        'conversation-1',
        OWN_ID,
      ),
    ).toBe(true);
    expect(
      isPendingConversationInvitationFor(
        conversationInvitation,
        'conversation-1',
        OTHER_ID,
      ),
    ).toBe(false);
  });
});

describe(isPendingCommunityInvitationFor.name, () => {
  it('matches the recipient addressed in PEM form', () => {
    expect(
      isPendingCommunityInvitationFor(
        communityInvitation,
        'community-1',
        OWN_ID,
      ),
    ).toBe(true);
    expect(
      isPendingCommunityInvitationFor(
        communityInvitation,
        'community-1',
        OTHER_ID,
      ),
    ).toBe(false);
  });
});
