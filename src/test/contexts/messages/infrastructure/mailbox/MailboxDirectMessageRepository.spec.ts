import { Timestamp } from '@haskou/value-objects';
import { mock, type MockProxy } from 'jest-mock-extended';

import type { ConversationResource } from '../../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { DirectMessageMailbox } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageMailbox';

import { ConversationAccessContexts } from '../../../../../contexts/conversations/infrastructure/http/ConversationAccessContexts';
import { ConversationAccessContextNotFoundError } from '../../../../../contexts/conversations/infrastructure/http/errors/ConversationAccessContextNotFoundError';
import { IdentityAccessContexts } from '../../../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import { MessagePinChange } from '../../../../../contexts/messages/domain/MessagePinChange';
import { MessageReactionChange } from '../../../../../contexts/messages/domain/MessageReactionChange';
import { MessageAuthorId } from '../../../../../contexts/messages/domain/value-objects/MessageAuthorId';
import { MessageConversationId } from '../../../../../contexts/messages/domain/value-objects/MessageConversationId';
import { MessageId } from '../../../../../contexts/messages/domain/value-objects/MessageId';
import { MessagePinAction } from '../../../../../contexts/messages/domain/value-objects/MessagePinAction';
import { MessageReactionAction } from '../../../../../contexts/messages/domain/value-objects/MessageReactionAction';
import { MessageReactionEmoji } from '../../../../../contexts/messages/domain/value-objects/MessageReactionEmoji';
import { MailboxDirectMessageRepository } from '../../../../../contexts/messages/infrastructure/mailbox/MailboxDirectMessageRepository';

const openConversation: ConversationResource = {
  adminIds: [],
  id: 'one-to-one:a',
  networkId: 'network-a',
  participantIds: ['identity-a', 'identity-b'],
  type: 'one-to-one',
};
const session = { identity: { id: 'identity-a' } } as Session;
const conversationId = MessageConversationId.fromString('one-to-one:a');
const actorId = MessageAuthorId.fromString('identity-a');
const messageId = MessageId.fromString('message-a');

describe(MailboxDirectMessageRepository.name, () => {
  let conversationContexts: ConversationAccessContexts;
  let mailbox: MockProxy<DirectMessageMailbox>;
  let repository: MailboxDirectMessageRepository;

  beforeEach(() => {
    const identityContexts = new IdentityAccessContexts();

    conversationContexts = new ConversationAccessContexts();
    mailbox = mock<DirectMessageMailbox>();
    identityContexts.register(session);
    repository = new MailboxDirectMessageRepository(
      identityContexts,
      conversationContexts,
      mailbox,
    );
  });

  describe('with the conversation open', () => {
    beforeEach(() => {
      conversationContexts.registerOpen(openConversation);
    });

    it('pins in the mailbox of the session with the change time', async () => {
      await repository.pin(
        conversationId,
        MessagePinChange.create(
          MessagePinAction.unpin(),
          messageId,
          new Timestamp(300),
        ),
        actorId,
      );

      expect(mailbox.pin).toHaveBeenCalledWith(session, openConversation, {
        action: 'unpin',
        createdAt: 300,
        messageId: 'message-a',
      });
    });

    it('reacts in the mailbox of the session with the change time', async () => {
      await repository.react(
        conversationId,
        MessageReactionChange.create(
          MessageReactionAction.remove(),
          MessageReactionEmoji.fromString('👍'),
          messageId,
          new Timestamp(400),
        ),
        actorId,
      );

      expect(mailbox.reaction).toHaveBeenCalledWith(session, openConversation, {
        action: 'remove',
        createdAt: 400,
        emoji: '👍',
        messageId: 'message-a',
      });
    });

    it('deletes in the mailbox of the session', async () => {
      await repository.delete(conversationId, messageId, actorId);

      expect(mailbox.delete).toHaveBeenCalledWith(
        session,
        openConversation,
        'message-a',
      );
    });
  });

  it('fails explicitly when the conversation was not registered open', async () => {
    await expect(
      repository.delete(conversationId, messageId, actorId),
    ).rejects.toThrow(ConversationAccessContextNotFoundError);
    expect(mailbox.delete).not.toHaveBeenCalled();
  });
});
