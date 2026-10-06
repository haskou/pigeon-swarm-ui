import { mock, type MockProxy } from 'jest-mock-extended';

import type { ConversationRepository } from '../../../../contexts/conversations/domain/repositories/ConversationRepository';

import { ConversationCreator } from '../../../../contexts/conversations/application/create-conversation/ConversationCreator';
import { CreateConversationMessage } from '../../../../contexts/conversations/application/create-conversation/messages/CreateConversationMessage';
import { GroupConversationCreator } from '../../../../contexts/conversations/application/create-group-conversation/GroupConversationCreator';
import { CreateGroupConversationMessage } from '../../../../contexts/conversations/application/create-group-conversation/messages/CreateGroupConversationMessage';
import { ConversationAdminDemoter } from '../../../../contexts/conversations/application/demote-conversation-admin/ConversationAdminDemoter';
import { DemoteConversationAdminMessage } from '../../../../contexts/conversations/application/demote-conversation-admin/messages/DemoteConversationAdminMessage';
import { ConversationLeaver } from '../../../../contexts/conversations/application/leave-conversation/ConversationLeaver';
import { LeaveConversationMessage } from '../../../../contexts/conversations/application/leave-conversation/messages/LeaveConversationMessage';
import { ConversationAdminPromoter } from '../../../../contexts/conversations/application/promote-conversation-admin/ConversationAdminPromoter';
import { PromoteConversationAdminMessage } from '../../../../contexts/conversations/application/promote-conversation-admin/messages/PromoteConversationAdminMessage';
import { ConversationParticipantRemover } from '../../../../contexts/conversations/application/remove-conversation-participant/ConversationParticipantRemover';
import { RemoveConversationParticipantMessage } from '../../../../contexts/conversations/application/remove-conversation-participant/messages/RemoveConversationParticipantMessage';
import { ConversationParticipantInviter } from '../../../../contexts/conversations/application/invite-to-group-conversation/ConversationParticipantInviter';
import { InviteConversationParticipantMessage } from '../../../../contexts/conversations/application/invite-to-group-conversation/messages/InviteConversationParticipantMessage';
import { ConversationReadMarker } from '../../../../contexts/conversations/application/mark-conversation-read-until/ConversationReadMarker';
import { MarkConversationReadUntilMessage } from '../../../../contexts/conversations/application/mark-conversation-read-until/messages/MarkConversationReadUntilMessage';
import { ConversationsSearcher } from '../../../../contexts/conversations/application/search-conversations/ConversationsSearcher';
import { SearchConversationsMessage } from '../../../../contexts/conversations/application/search-conversations/messages/SearchConversationsMessage';
import { Conversation } from '../../../../contexts/conversations/domain/Conversation';
import { ConversationIdFactory } from '../../../../contexts/conversations/domain/ConversationIdFactory';

function conversation(
  id: string,
  latestMessageAt: number,
  type: 'group' | 'one-to-one' = 'one-to-one',
  unreadCount = 0,
): Conversation {
  return Conversation.fromPrimitives({
    id,
    latestMessageAt,
    name: type === 'group' ? 'Friends' : undefined,
    networkId: 'network-a',
    adminIds: [],
    creatorId: 'identity-a',
    participantIds: ['identity-a', 'identity-b'],
    type,
    unreadCount,
  });
}

describe('conversation use cases', () => {
  let conversationRepository: MockProxy<ConversationRepository>;

  beforeEach(() => {
    conversationRepository = mock<ConversationRepository>();
  });

  it('creates a direct conversation through its repository', async () => {
    const created = conversation('one-to-one:a', 0);

    conversationRepository.create.mockResolvedValue(created);

    await expect(
      new ConversationCreator(
        conversationRepository,
        new ConversationIdFactory(),
      ).create(
        new CreateConversationMessage(
          'network-a',
          'identity-b',
          'identity-a',
          100,
        ),
      ),
    ).resolves.toBe(created);

    const aggregate = conversationRepository.create.mock.calls[0]?.[0];

    expect(aggregate).toBeInstanceOf(Conversation);
    expect(aggregate?.pullDomainEvents()).toEqual([
      expect.objectContaining({ type: 'ConversationCreated' }),
    ]);
  });

  it('creates a group conversation through its repository', async () => {
    const created = conversation('group:a', 0, 'group');

    conversationRepository.createGroup.mockResolvedValue(created);

    await expect(
      new GroupConversationCreator(
        conversationRepository,
        new ConversationIdFactory(),
      ).create(
        new CreateGroupConversationMessage(
          'Friends',
          'network-a',
          ['identity-b'],
          'identity-a',
          100,
        ),
      ),
    ).resolves.toBe(created);

    const aggregate = conversationRepository.createGroup.mock.calls[0]?.[0];
    const nonce = conversationRepository.createGroup.mock.calls[0]?.[1];

    expect(aggregate).toBeInstanceOf(Conversation);
    expect(aggregate?.toPrimitives()).toEqual(
      expect.objectContaining({
        adminIds: [],
        creatorId: 'identity-a',
        id: expect.stringMatching(/^group:[\w-]{43}$/),
        participantIds: ['identity-a', 'identity-b'],
      }),
    );
    expect(nonce?.toString()).toMatch(/^[\w-]{22}$/);
  });

  it('removes a participant through the aggregate', async () => {
    const group = conversation('group:a', 0, 'group');
    const removed = conversation('group:a', 0, 'group');

    conversationRepository.find.mockResolvedValue(group);
    conversationRepository.removeParticipant.mockResolvedValue(removed);

    await expect(
      new ConversationParticipantRemover(conversationRepository).remove(
        new RemoveConversationParticipantMessage(
          'group:a',
          'identity-b',
          'identity-a',
          200,
        ),
      ),
    ).resolves.toBe(removed);
    expect(group.pullDomainEvents()).toEqual([
      expect.objectContaining({ type: 'ConversationParticipantRemoved' }),
    ]);
  });

  it('promotes and demotes an admin through the aggregate', async () => {
    const group = conversation('group:a', 0, 'group');

    conversationRepository.find.mockResolvedValue(group);
    conversationRepository.promoteAdmin.mockResolvedValue(group);
    conversationRepository.demoteAdmin.mockResolvedValue(group);

    await new ConversationAdminPromoter(conversationRepository).promote(
      new PromoteConversationAdminMessage(
        'group:a',
        'identity-b',
        'identity-a',
        200,
      ),
    );
    await new ConversationAdminDemoter(conversationRepository).demote(
      new DemoteConversationAdminMessage(
        'group:a',
        'identity-b',
        'identity-a',
        300,
      ),
    );

    expect(group.pullDomainEvents()).toEqual([
      expect.objectContaining({ type: 'ConversationAdminPromoted' }),
      expect.objectContaining({ type: 'ConversationAdminDemoted' }),
    ]);
  });

  it('leaves a group through the aggregate', async () => {
    const group = conversation('group:a', 0, 'group');
    const left = conversation('group:a', 0, 'group');

    conversationRepository.find.mockResolvedValue(group);
    conversationRepository.leave.mockResolvedValue(left);

    await expect(
      new ConversationLeaver(conversationRepository).leave(
        new LeaveConversationMessage('group:a', 'identity-b', 200),
      ),
    ).resolves.toBe(left);
    expect(group.pullDomainEvents()).toEqual([
      expect.objectContaining({ type: 'ConversationParticipantLeft' }),
    ]);
  });

  it('invites a participant through the aggregate', async () => {
    const group = conversation('group:a', 0, 'group');

    conversationRepository.find.mockResolvedValue(group);

    await new ConversationParticipantInviter(conversationRepository).invite(
      new InviteConversationParticipantMessage(
        'group:a',
        'identity-c',
        'identity-a',
        200,
      ),
    );

    expect(conversationRepository.invite).toHaveBeenCalledWith(
      group,
      expect.anything(),
      expect.anything(),
    );
    expect(group.pullDomainEvents()).toHaveLength(1);
  });

  it('marks a conversation read through the aggregate', async () => {
    const direct = conversation('one-to-one:a', 0, 'one-to-one', 1);

    conversationRepository.find.mockResolvedValue(direct);

    await new ConversationReadMarker(conversationRepository).mark(
      new MarkConversationReadUntilMessage(
        'one-to-one:a',
        'message-a',
        'identity-a',
        200,
      ),
    );

    expect(conversationRepository.markReadUntil).toHaveBeenCalledWith(
      direct,
      expect.anything(),
      expect.anything(),
    );
    expect(direct.pullDomainEvents()).toHaveLength(1);
  });

  it('returns conversations ordered by latest activity', async () => {
    const oldConversation = conversation('one-to-one:old', 100);
    const recentConversation = conversation('one-to-one:recent', 200);

    conversationRepository.searchByIdentity.mockResolvedValue([
      oldConversation,
      recentConversation,
    ]);

    await expect(
      new ConversationsSearcher(conversationRepository).search(
        new SearchConversationsMessage('identity-a'),
      ),
    ).resolves.toEqual([oldConversation, recentConversation]);
  });
});
