import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

const created = 'MessageCreated';
const deleted = 'MessageDeleted';
const edited = 'MessageEdited';
const pinned = 'MessagePinned';
const reactionAdded = 'MessageReactionAdded';
const reactionRemoved = 'MessageReactionRemoved';
const unpinned = 'MessageUnpinned';
const values = [
  created,
  deleted,
  edited,
  pinned,
  reactionAdded,
  reactionRemoved,
  unpinned,
] as const;

export class MessageEventType extends Enum<(typeof values)[number]> {
  public static readonly CREATED = new MessageEventType(created);

  public static readonly DELETED = new MessageEventType(deleted);

  public static readonly EDITED = new MessageEventType(edited);

  public static readonly PINNED = new MessageEventType(pinned);

  public static readonly REACTION_ADDED = new MessageEventType(reactionAdded);

  public static readonly REACTION_REMOVED = new MessageEventType(
    reactionRemoved,
  );

  public static readonly UNPINNED = new MessageEventType(unpinned);

  public static fromPrimitives(value: string): MessageEventType {
    const eventType = values.find((candidate) => candidate === value);

    if (!eventType) throw new ValueNotInEnumError(value, [...values]);

    return new MessageEventType(eventType);
  }

  private constructor(value: (typeof values)[number]) {
    super(value);
  }

  public getValues(): Array<(typeof values)[number]> {
    return [...values];
  }
}
