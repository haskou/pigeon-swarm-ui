import { mock } from 'jest-mock-extended';

import type { ConversationResource } from '../../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { DirectMessageMailbox } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageMailbox';

import { ConversationId } from '../../../../../contexts/conversations/domain/value-objects/ConversationId';
import { ConversationParticipantId } from '../../../../../contexts/conversations/domain/value-objects/ConversationParticipantId';
import { MessageId } from '../../../../../contexts/conversations/domain/value-objects/MessageId';
import { ConversationAccessContexts } from '../../../../../contexts/conversations/infrastructure/http/ConversationAccessContexts';
import { ConversationAccessContextNotFoundError } from '../../../../../contexts/conversations/infrastructure/http/errors/ConversationAccessContextNotFoundError';
import { MailboxConversationReadReceiptRepository } from '../../../../../contexts/conversations/infrastructure/mailbox/MailboxConversationReadReceiptRepository';
import { sessionFixture } from '../../ConversationFixture';

const openConversation: ConversationResource = {
  adminIds: [],
  id: 'one-to-one:a',
  networkId: 'network-a',
  participantIds: ['identity-a', 'identity-b'],
  type: 'one-to-one',
};

describe(MailboxConversationReadReceiptRepository.name, () => {
  it('marks the open conversation read in the mailbox of the session', async () => {
    const contexts = new ConversationAccessContexts();
    const mailbox = mock<DirectMessageMailbox>();
    const session = sessionFixture();

    contexts.register(session);
    contexts.registerOpen(openConversation);

    await new MailboxConversationReadReceiptRepository(
      contexts,
      mailbox,
    ).markRead(
      ConversationId.fromString('one-to-one:a'),
      MessageId.fromString('message-a'),
      ConversationParticipantId.fromString('identity-a'),
    );

    expect(mailbox.markRead).toHaveBeenCalledWith(
      session,
      openConversation,
      'message-a',
    );
  });

  it('fails explicitly when the conversation was not registered open', async () => {
    const contexts = new ConversationAccessContexts();
    const mailbox = mock<DirectMessageMailbox>();

    contexts.register(sessionFixture());

    await expect(
      new MailboxConversationReadReceiptRepository(contexts, mailbox).markRead(
        ConversationId.fromString('one-to-one:a'),
        MessageId.fromString('message-a'),
        ConversationParticipantId.fromString('identity-a'),
      ),
    ).rejects.toThrow(ConversationAccessContextNotFoundError);
    expect(mailbox.markRead).not.toHaveBeenCalled();
  });
});
