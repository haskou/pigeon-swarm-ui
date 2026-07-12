import type {
  ChatMessage,
  Community,
} from '../../../../../shared/domain/pigeonResources.types';

import { CommunityWorkspaceDialogActions } from '../../../../../contexts/communities/presentation/components/CommunityWorkspaceDialogActions';
import { copy } from '../../../../../shared/presentation/i18n/copy';

const community = (): Community => ({
  createdAt: 100,
  description: 'A community',
  id: 'community-a',
  memberIds: ['owner-a', 'member-a'],
  memberRoles: [{ identityId: 'member-a', roleIds: ['role-a'] }],
  name: 'Builders',
  networkId: 'network-a',
  ownerIdentityId: 'owner-a',
  roles: [
    {
      builtIn: true,
      id: 'everyone',
      name: 'everyone',
      permissions: ['view_channels'],
    },
    {
      id: 'role-a',
      name: 'Ops',
      permissions: ['manage_messages'],
    },
  ],
  textChannels: [],
  visibility: 'private',
});

const message = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  attachments: [],
  authorIdentityId: 'member-a',
  content: 'hello',
  encrypted: false,
  id: 'message-a',
  kind: 'message',
  mine: false,
  raw: {},
  reactions: [],
  timestamp: 100,
  ...overrides,
});

describe(CommunityWorkspaceDialogActions.name, () => {
  it('allows message deletion for own messages and moderators but never poll items', () => {
    expect(
      CommunityWorkspaceDialogActions.canDeleteMessage({
        currentPermissions: new Set(),
        message: message({ mine: true }),
        owner: false,
      }),
    ).toBe(true);

    expect(
      CommunityWorkspaceDialogActions.canDeleteMessage({
        currentPermissions: new Set(['manage_messages']),
        message: message(),
        owner: false,
      }),
    ).toBe(true);

    expect(
      CommunityWorkspaceDialogActions.canDeleteMessage({
        currentPermissions: new Set(['manage_messages']),
        message: message({ kind: 'poll' }),
        owner: true,
      }),
    ).toBe(false);
  });

  it('reuses the message edit policy for contextual edit actions', () => {
    expect(
      CommunityWorkspaceDialogActions.canEditMessage(
        message({ authorIdentityId: 'member-a' }),
        'member-a',
      ),
    ).toBe(true);

    expect(
      CommunityWorkspaceDialogActions.canEditMessage(
        message({ authorIdentityId: 'other-member' }),
        'member-a',
      ),
    ).toBe(false);
  });

  it('opens conversations only for other identities when a handler exists', () => {
    expect(
      CommunityWorkspaceDialogActions.canOpenConversation({
        currentIdentityId: 'member-a',
        hasConversationHandler: true,
        profileIdentityId: 'member-b',
      }),
    ).toBe(true);

    expect(
      CommunityWorkspaceDialogActions.canOpenConversation({
        currentIdentityId: 'member-a',
        hasConversationHandler: true,
        profileIdentityId: 'member-a',
      }),
    ).toBe(false);

    expect(
      CommunityWorkspaceDialogActions.canOpenConversation({
        currentIdentityId: 'member-a',
        hasConversationHandler: false,
        profileIdentityId: 'member-b',
      }),
    ).toBe(false);
  });

  it('builds profile role names including the owner badge and assigned roles', () => {
    expect(
      CommunityWorkspaceDialogActions.profileRoleNames(community(), 'owner-a'),
    ).toEqual([copy.communities.owner, copy.communities.visibleToEveryone]);

    expect(
      CommunityWorkspaceDialogActions.profileRoleNames(community(), 'member-a'),
    ).toEqual([copy.communities.visibleToEveryone, 'Ops']);
  });

  it('does not show implicit community roles for expelled identities', () => {
    expect(
      CommunityWorkspaceDialogActions.profileRoleNames(
        community(),
        'expelled-member',
      ),
    ).toEqual([]);
  });
});
