import { Timestamp } from '@haskou/value-objects';

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

const receivedAt = new Timestamp(1_000);
const MAX_FUTURE_SKEW_MS = 30_000;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

describe(MessagePinClock.name, () => {
  it('admits the first change for a message', () => {
    const clock = new MessagePinClock();
    const pin = change('pin', 300);

    expect(clock.admit([pin], receivedAt)).toEqual([pin]);
  });

  it('admits a later change for the same message in the same pass', () => {
    const clock = new MessagePinClock();
    const pin = change('pin', 300);
    const unpin = change('unpin', 400);

    expect(clock.admit([pin, unpin], receivedAt)).toEqual([pin, unpin]);
  });

  it('drops an older change delivered after a newer one in the same pass', () => {
    const clock = new MessagePinClock();
    const unpin = change('unpin', 400);

    expect(clock.admit([unpin, change('pin', 300)], receivedAt)).toEqual([
      unpin,
    ]);
  });

  it('drops a change older than the last admitted write across passes', () => {
    const clock = new MessagePinClock();
    clock.admit([change('unpin', 400)], receivedAt);

    expect(clock.admit([change('pin', 300)], receivedAt)).toEqual([]);
  });

  it('drops a replayed change with the same createdAt', () => {
    const clock = new MessagePinClock();
    clock.admit([change('pin', 300)], receivedAt);

    expect(clock.admit([change('pin', 300)], receivedAt)).toEqual([]);
  });

  it('keeps one clock per message', () => {
    const clock = new MessagePinClock();
    clock.admit([change('pin', 400, 'message-1')], receivedAt);
    const other = change('pin', 300, 'message-2');

    expect(clock.admit([other], receivedAt)).toEqual([other]);
  });

  it('clamps a far-future change to the receive time window', () => {
    const clock = new MessagePinClock();

    const [admitted] = clock.admit(
      [change('pin', 9_000_000_000_000)],
      receivedAt,
    );

    expect(admitted?.getCreatedAt().valueOf()).toBe(
      receivedAt.valueOf() + MAX_FUTURE_SKEW_MS,
    );
  });

  it('lets a later honest change win over a far-future one', () => {
    const clock = new MessagePinClock();
    clock.admit([change('pin', 9_000_000_000_000)], receivedAt);
    const unpin = change('unpin', 40_000);

    expect(clock.admit([unpin], new Timestamp(40_000))).toEqual([unpin]);
  });

  it('clamps a change older than the window to its oldest edge', () => {
    const clock = new MessagePinClock();
    const later = new Timestamp(MAX_AGE_MS + 5_000);

    const [admitted] = clock.admit([change('pin', 1)], later);

    expect(admitted?.getCreatedAt().valueOf()).toBe(5_000);
  });

  it('keeps a change inside the window unchanged', () => {
    const clock = new MessagePinClock();
    const pin = change('pin', receivedAt.valueOf() + MAX_FUTURE_SKEW_MS);

    expect(clock.admit([pin], receivedAt)).toEqual([pin]);
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
