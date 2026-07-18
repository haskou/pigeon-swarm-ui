import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

const values = ['call-event', 'message', 'poll', 'sticker'] as const;

export class MessageKind extends Enum<(typeof values)[number]> {
  public static callEvent(): MessageKind {
    return new MessageKind('call-event');
  }

  public static fromPrimitives(value = 'message'): MessageKind {
    const kind = values.find((candidate) => candidate === value);

    if (!kind) throw new ValueNotInEnumError(value, values);

    return new MessageKind(kind);
  }

  public static message(): MessageKind {
    return new MessageKind('message');
  }

  public static poll(): MessageKind {
    return new MessageKind('poll');
  }

  public static sticker(): MessageKind {
    return new MessageKind('sticker');
  }

  private constructor(value: (typeof values)[number]) {
    super(value);
  }

  public getValues(): Array<(typeof values)[number]> {
    return [...values];
  }

  public isEditableText(): boolean {
    return this.isEqual(MessageKind.message());
  }
}
