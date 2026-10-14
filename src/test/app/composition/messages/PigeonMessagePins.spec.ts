import { mock } from 'jest-mock-extended';

import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { MessagePinner } from '../../../../contexts/messages/application/pin-message/MessagePinner';
import type { MessageUnpinner } from '../../../../contexts/messages/application/unpin-message/MessageUnpinner';

import { PigeonMessagePins } from '../../../../app/composition/messages/PigeonMessagePins';
import { ConversationId } from '../../../../contexts/conversations/domain/value-objects/ConversationId';
import { ConversationAccessContexts } from '../../../../contexts/conversations/infrastructure/http/ConversationAccessContexts';
import { IdentityAccessContexts } from '../../../../contexts/identities/infrastructure/http/IdentityAccessContexts';

const session = { identity: { id: 'reader-a' } } as Session;
const oneToOne: ConversationResource = {
  adminIds: [],
  id: 'one-to-one:a',
  networkId: 'network-a',
  participantIds: ['reader-a', 'friend-a'],
  type: 'one-to-one',
  unreadCount: 0,
};

describe(PigeonMessagePins.name, () => {
  it('opens the conversation and hands the message to the pin use cases', async () => {
    const conversationContexts = new ConversationAccessContexts();
    const pinner = mock<MessagePinner>();
    const unpinner = mock<MessageUnpinner>();
    const pins = new PigeonMessagePins(
      new IdentityAccessContexts(),
      conversationContexts,
      pinner,
      unpinner,
    );

    await pins.pin(session, oneToOne, 'message-a');
    await pins.unpin(session, oneToOne, 'message-a');

    const [pinned] = pinner.pin.mock.calls[0] ?? [];
    const [unpinned] = unpinner.unpin.mock.calls[0] ?? [];

    expect(
      conversationContexts.findOpen(ConversationId.fromString('one-to-one:a')),
    ).toBe(oneToOne);
    expect(pinned?.getMessageId().toString()).toBe('message-a');
    expect(unpinned?.getMessageId().toString()).toBe('message-a');
  });
});
