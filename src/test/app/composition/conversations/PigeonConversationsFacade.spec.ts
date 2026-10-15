import { mock, mockDeep } from 'jest-mock-extended';

import type { ConversationUseCases } from '../../../../app/composition/conversations/ConversationUseCases';
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
  'create' | 'membersChanged'
>;

describe(PigeonConversationsFacade.name, () => {
  it('registers the session and maps searched aggregates for presentation', async () => {
    const useCases = mockDeep<ConversationUseCases>();
    const conversation = conversationFixture();

    useCases.searcher.search.mockResolvedValue([conversation]);

    await expect(
      new PigeonConversationsFacade(
        new ConversationAccessContexts(),
        new ConversationMapper(),
        useCases,
        mock<GroupMembership>(),
      ).list(sessionFixture()),
    ).resolves.toEqual([
      expect.objectContaining({ id: 'one-to-one:a', type: 'one-to-one' }),
    ]);
  });

  it('returns the keychain published while creating a conversation', async () => {
    const contexts = new ConversationAccessContexts();
    const useCases = mockDeep<ConversationUseCases>();

    useCases.creator.create.mockResolvedValue(conversationFixture());

    await expect(
      new PigeonConversationsFacade(
        contexts,
        new ConversationMapper(),
        useCases,
        mock<GroupMembership>(),
      ).create(sessionFixture(), 'identity-b', 'network-a'),
    ).resolves.toMatchObject({
      conversation: { id: 'one-to-one:a' },
      keychainExternalIdentifier: 'keychain-a',
    });
  });

  it('starts the MLS group of a group it creates from the genesis of its id', async () => {
    const groups = mock<GroupMembership>();
    const useCases = mockDeep<ConversationUseCases>();
    const session = sessionFixture();

    useCases.groupCreator.create.mockResolvedValue(
      conversationFixture({ type: 'group' }),
    );

    await new PigeonConversationsFacade(
      new ConversationAccessContexts(),
      new ConversationMapper(),
      useCases,
      groups,
    ).createGroup(session, {
      name: 'Friends',
      networkId: 'network-a',
      participantIds: ['identity-b'],
    });

    const [message] = useCases.groupCreator.create.mock.calls[0];

    expect(message.getNonce().toString()).toMatch(/^[\w-]{22}$/);
    expect(groups.create).toHaveBeenCalledWith(session, 'group:a', {
      creatorIdentityId: session.identity.id,
      networkId: 'network-a',
      nonce: message.getNonce().toString(),
    });
  });

  it.each([
    [
      'inviting',
      (facade: PigeonConversationsFacade): Promise<unknown> =>
        facade.inviteToGroup(sessionFixture(), 'group:a', 'identity-c'),
    ],
    [
      'removing',
      (facade: PigeonConversationsFacade): Promise<unknown> =>
        facade.removeParticipant(sessionFixture(), 'group:a', 'identity-b'),
    ],
  ])('updates the MLS group after %s a member', async (_name, change) => {
    const groups = mock<GroupMembership>();
    const useCases = mockDeep<ConversationUseCases>();
    const group = conversationFixture({ type: 'group' });

    useCases.participantInviter.invite.mockResolvedValue(group);
    useCases.participantRemover.remove.mockResolvedValue(group);

    await change(
      new PigeonConversationsFacade(
        new ConversationAccessContexts(),
        new ConversationMapper(),
        useCases,
        groups,
      ),
    );

    expect(groups.membersChanged).toHaveBeenCalledWith(
      sessionFixture(),
      'group:a',
    );
  });
});
