import { StringValueObject, ValueNotInEnumError } from '@haskou/value-objects';

import type { MessageKindPrimitive } from './MessageKindPrimitive';

const callEvent = 'call-event';
const message = 'message';
const poll = 'poll';
const sticker = 'sticker';

export class MessageKind extends StringValueObject {
  public static callEvent(): MessageKind {
    return new MessageKind(callEvent);
  }

  public static fromPrimitive(value?: string): MessageKind {
    if (value === undefined || value === message) return MessageKind.message();

    if (value === callEvent) return MessageKind.callEvent();

    if (value === poll) return MessageKind.poll();

    if (value === sticker) return MessageKind.sticker();

    throw new ValueNotInEnumError(value, [callEvent, message, poll, sticker]);
  }

  public static message(): MessageKind {
    return new MessageKind(message);
  }

  public static poll(): MessageKind {
    return new MessageKind(poll);
  }

  public static sticker(): MessageKind {
    return new MessageKind(sticker);
  }

  private constructor(value: MessageKindPrimitive) {
    super(value);
  }

  public isEditableText(): boolean {
    return this.isEqual(MessageKind.message());
  }
}
