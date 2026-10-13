import { MessagePinChange } from '../../../../contexts/messages/domain/MessagePinChange';
import { MessagePinClock } from '../../../../contexts/messages/domain/MessagePinClock';
import { MessageId } from '../../../../contexts/messages/domain/value-objects/MessageId';

function change(
  action: 'pin' | 'unpin',
  createdAt: number,
  messageId = 'message-1',
): MessagePinChange {
  return MessagePinChange.fromPrimitives({ action, createdAt, messageId });
}

describe(MessagePinClock.name, () => {
  it('admits the first change for a message', () => {
    const clock = new MessagePinClock();
    const pin = change('pin', 300);

    expect(clock.admit([pin])).toEqual([pin]);
  });

  it('admits a later change for the same message in the same pass', () => {
    const clock = new MessagePinClock();
    const pin = change('pin', 300);
    const unpin = change('unpin', 400);

    expect(clock.admit([pin, unpin])).toEqual([pin, unpin]);
  });

  it('drops an older change delivered after a newer one in the same pass', () => {
    const clock = new MessagePinClock();
    const unpin = change('unpin', 400);

    expect(clock.admit([unpin, change('pin', 300)])).toEqual([unpin]);
  });

  it('drops a change older than the last admitted write across passes', () => {
    const clock = new MessagePinClock();
    clock.admit([change('unpin', 400)]);

    expect(clock.admit([change('pin', 300)])).toEqual([]);
  });

  it('drops a replayed change with the same createdAt', () => {
    const clock = new MessagePinClock();
    clock.admit([change('pin', 300)]);

    expect(clock.admit([change('pin', 300)])).toEqual([]);
  });

  it('keeps one clock per message', () => {
    const clock = new MessagePinClock();
    clock.admit([change('pin', 400, 'message-1')]);
    const other = change('pin', 300, 'message-2');

    expect(clock.admit([other])).toEqual([other]);
  });

  it('pins and unpins the admitted changes in order', () => {
    const pinned = [MessageId.fromString('message-1')];

    expect(
      MessagePinClock.applyTo(pinned, [
        change('unpin', 300, 'message-1'),
        change('pin', 400, 'message-2'),
        change('pin', 500, 'message-2'),
      ]),
    ).toEqual([MessageId.fromString('message-2')]);
  });

  it('keeps the pinned set unchanged for an unpin of a message not pinned', () => {
    const pinned = [MessageId.fromString('message-1')];

    expect(
      MessagePinClock.applyTo(pinned, [change('unpin', 300, 'other')]),
    ).toEqual([MessageId.fromString('message-1')]);
  });
});
