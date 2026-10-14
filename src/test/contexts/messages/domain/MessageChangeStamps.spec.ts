import { MessagePinChange } from '../../../../contexts/messages/domain/MessagePinChange';
import { MessageReactionChange } from '../../../../contexts/messages/domain/MessageReactionChange';
import { MessageId } from '../../../../contexts/messages/domain/value-objects/MessageId';
import { MessagePinAction } from '../../../../contexts/messages/domain/value-objects/MessagePinAction';
import { MessageReactionAction } from '../../../../contexts/messages/domain/value-objects/MessageReactionAction';
import { MessageReactionEmoji } from '../../../../contexts/messages/domain/value-objects/MessageReactionEmoji';

const now = 1_700_000_000_000;

describe('message change stamps', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stamps a pin made now with the domain clock', () => {
    const change = MessagePinChange.now(
      MessagePinAction.unpin(),
      MessageId.fromString('message-1'),
    );

    expect(change.getCreatedAt().valueOf()).toBe(now);
    expect(change.getAction().isPin()).toBe(false);
    expect(change.getMessageId().toString()).toBe('message-1');
  });

  it('stamps a reaction made now with the domain clock', () => {
    const change = MessageReactionChange.now(
      MessageReactionAction.add(),
      MessageReactionEmoji.fromString('👍'),
      MessageId.fromString('message-1'),
    );

    expect(change.getCreatedAt().valueOf()).toBe(now);
    expect(change.getEmoji().toString()).toBe('👍');
  });
});
