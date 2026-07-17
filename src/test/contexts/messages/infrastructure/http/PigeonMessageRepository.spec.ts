import { Timestamp } from '@haskou/value-objects';
import { mock } from 'jest-mock-extended';

import type { PigeonMessageCommandsApi } from '../../../../../contexts/messages/infrastructure/http/PigeonMessageCommandsApi';
import type { PigeonMessagesApi } from '../../../../../contexts/messages/infrastructure/http/PigeonMessagesApi';
import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { IdentityAccessContexts } from '../../../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import { Message } from '../../../../../contexts/messages/domain/Message';
import { MessageAuthorId } from '../../../../../contexts/messages/domain/value-objects/MessageAuthorId';
import { MessageContent } from '../../../../../contexts/messages/domain/value-objects/MessageContent';
import { MessageConversationId } from '../../../../../contexts/messages/domain/value-objects/MessageConversationId';
import { MessageId } from '../../../../../contexts/messages/domain/value-objects/MessageId';
import { MessageKind } from '../../../../../contexts/messages/domain/value-objects/MessageKind';
import { MessagePageLimit } from '../../../../../contexts/messages/domain/value-objects/MessagePageLimit';
import { MessageVisibility } from '../../../../../contexts/messages/domain/value-objects/MessageVisibility';
import { MessageMapper } from '../../../../../contexts/messages/infrastructure/http/MessageMapper';
import { MessageOperationContexts } from '../../../../../contexts/messages/infrastructure/http/MessageOperationContexts';
import { PigeonMessageRepository } from '../../../../../contexts/messages/infrastructure/http/PigeonMessageRepository';

const session = { identity: { id: 'author-a' } } as Session;
const projection = {
  attachments: [],
  authorIdentityId: 'author-a',
  content: 'Hello',
  encrypted: true,
  id: 'message-a',
  mine: true,
  raw: {
    authorIdentityId: 'author-a',
    conversationId: 'conversation-a',
    createdAt: 100,
    id: 'message-a',
    type: 'sent' as const,
  },
  reactions: [],
  timestamp: 100,
};

describe(PigeonMessageRepository.name, () => {
  it('persists a created aggregate through the command API', async () => {
    const messages = mock<PigeonMessagesApi>();
    const commands = mock<PigeonMessageCommandsApi>();
    const identities = new IdentityAccessContexts();
    const operations = new MessageOperationContexts();
    const repository = new PigeonMessageRepository(
      messages,
      commands,
      identities,
      new MessageMapper(),
      operations,
    );
    const aggregate = Message.create(
      MessageId.fromString('message-a'),
      MessageConversationId.fromString('conversation-a'),
      MessageAuthorId.fromString('author-a'),
      MessageContent.fromString('Hello'),
      MessageKind.message(),
      MessageVisibility.encrypted(),
      new Timestamp(100),
    );

    identities.register(session);
    operations.registerSend('message-a', { previousMessageIds: ['older'] });
    commands.send.mockResolvedValue(projection);

    await expect(repository.create(aggregate)).resolves.toBeInstanceOf(Message);
    expect(commands.send).toHaveBeenCalledWith(
      session,
      'conversation-a',
      'Hello',
      { previousMessageIds: ['older'] },
      { createdAt: 100, id: 'message-a' },
    );
  });

  it('maps searched HTTP messages into a domain page', async () => {
    const messages = mock<PigeonMessagesApi>();
    const identities = new IdentityAccessContexts();
    const repository = new PigeonMessageRepository(
      messages,
      mock<PigeonMessageCommandsApi>(),
      identities,
      new MessageMapper(),
      new MessageOperationContexts(),
    );

    identities.register(session);
    messages.loadMessages.mockResolvedValue({
      messages: [projection],
      nextCursor: 'older',
    });
    const page = await repository.search(
      MessageConversationId.fromString('conversation-a'),
      MessageAuthorId.fromString('author-a'),
      undefined,
      MessagePageLimit.fromNumber(30),
    );

    expect(page.mapMessages((message) => message.toPrimitives().id)).toEqual([
      'message-a',
    ]);
    expect(page.getNextCursor()?.isEqual(MessageId.fromString('older'))).toBe(
      true,
    );
  });

  it('preserves pin metadata when mapping pinned messages', async () => {
    const messages = mock<PigeonMessagesApi>();
    const identities = new IdentityAccessContexts();
    const repository = new PigeonMessageRepository(
      messages,
      mock<PigeonMessageCommandsApi>(),
      identities,
      new MessageMapper(),
      new MessageOperationContexts(),
    );

    identities.register(session);
    messages.listMessagePins.mockResolvedValue([
      {
        createdAt: 50,
        message: projection,
        messageId: 'message-a',
        pinnedByIdentityId: 'moderator-a',
      },
    ]);

    const [pin] = await repository.searchPinned(
      MessageConversationId.fromString('conversation-a'),
      MessageAuthorId.fromString('author-a'),
    );

    expect(pin.toPrimitives()).toMatchObject({
      createdAt: 50,
      messageId: 'message-a',
      pinnedByIdentityId: 'moderator-a',
    });
  });
});
