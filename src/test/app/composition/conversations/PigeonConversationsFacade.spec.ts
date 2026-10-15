import { mock, mockDeep } from 'jest-mock-extended';

import type { ConversationUseCases } from '../../../../app/composition/conversations/ConversationUseCases';
import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { GroupConversationMailbox } from '../../../../contexts/groupMailboxes/infrastructure/GroupConversationMailbox';

import { PigeonConversationsFacade } from '../../../../app/composition/conversations/PigeonConversationsFacade';
import { ConversationAccessContexts } from '../../../../contexts/conversations/infrastructure/http/ConversationAccessContexts';
import { ConversationMapper } from '../../../../contexts/conversations/infrastructure/http/ConversationMapper';
import {
  conversationFixture,
  sessionFixture,
} from '../../../contexts/conversations/ConversationFixture';

type GroupMembership = Pick<
  GroupConversationMailbox,
  | 'addMember'
  | 'conversations'
  | 'create'
  | 'demote'
  | 'leave'
  | 'promote'
  | 'removeMember'
>;

const group: ConversationResource = {
  adminIds: [],
  creatorId: 'identity-a',
  id: 'group:a',
  name: 'Friends',
  networkId: 'network-a',
  participantIds: ['identity-a', 'identity-b'],
  type: 'group',
};

describe(PigeonConversationsFacade.name, () => {
  it('lists the node one-to-one conversations, then the groups this device holds', async () => {
    const useCases = mockDeep<ConversationUseCases>();
    const groups = mock<GroupMembership>();

    useCases.searcher.search.mockResolvedValue([conversationFixture()]);
    groups.conversations.mockResolvedValue([group]);

    await expect(
      new PigeonConversationsFacade(
        new ConversationAccessContexts(),
        new ConversationMapper(),
        useCases,
        groups,
      ).list(sessionFixture()),
    ).resolves.toEqual([
      expect.objectContaining({ id: 'one-to-one:a', type: 'one-to-one' }),
      group,
    ]);
  });

  it('returns the keychain published while creating a conversation', async () => {
    const useCases = mockDeep<ConversationUseCases>();

    useCases.creator.create.mockResolvedValue(conversationFixture());

    await expect(
      new PigeonConversationsFacade(
        new ConversationAccessContexts(),
        new ConversationMapper(),
        useCases,
        mock<GroupMembership>(),
      ).create(sessionFixture(), 'identity-b', 'network-a'),
    ).resolves.toMatchObject({
      conversation: { id: 'one-to-one:a' },
      keychainExternalIdentifier: 'keychain-a',
    });
  });

  it.each<
    [
      string,
      (facade: PigeonConversationsFacade) => Promise<unknown>,
      keyof GroupMembership,
      unknown[],
    ]
  >([
    [
      'creates a group',
      (facade) =>
        facade.createGroup(sessionFixture(), {
          name: 'Friends',
          networkId: 'network-a',
          participantIds: ['identity-b'],
        }),
      'create',
      [
        {
          name: 'Friends',
          networkId: 'network-a',
          participantIds: ['identity-b'],
        },
      ],
    ],
    [
      'invites',
      (facade) =>
        facade.inviteToGroup(sessionFixture(), 'group:a', 'identity-c'),
      'addMember',
      ['group:a', 'identity-c'],
    ],
    [
      'removes',
      (facade) =>
        facade.removeParticipant(sessionFixture(), 'group:a', 'identity-b'),
      'removeMember',
      ['group:a', 'identity-b'],
    ],
    [
      'promotes',
      (facade) =>
        facade.promoteAdmin(sessionFixture(), 'group:a', 'identity-b'),
      'promote',
      ['group:a', 'identity-b'],
    ],
    [
      'demotes',
      (facade) => facade.demoteAdmin(sessionFixture(), 'group:a', 'identity-b'),
      'demote',
      ['group:a', 'identity-b'],
    ],
    [
      'leaves',
      (facade) => facade.leave(sessionFixture(), 'group:a'),
      'leave',
      ['group:a'],
    ],
  ])(
    '%s through the MLS roster, without any node conversation request',
    async (_name, run, method, args) => {
      const useCases = mockDeep<ConversationUseCases>();
      const groups = mock<GroupMembership>();

      groups.create.mockResolvedValue(group);

      await run(
        new PigeonConversationsFacade(
          new ConversationAccessContexts(),
          new ConversationMapper(),
          useCases,
          groups,
        ),
      );

      expect(groups[method]).toHaveBeenCalledWith(sessionFixture(), ...args);
      expect(useCases.creator.create).not.toHaveBeenCalled();
      expect(useCases.searcher.search).not.toHaveBeenCalled();
    },
  );
});
