import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

const values = ['group', 'one-to-one'] as const;

export class ConversationType extends Enum<(typeof values)[number]> {
  public static readonly GROUP = new ConversationType('group');

  public static readonly ONE_TO_ONE = new ConversationType('one-to-one');

  public static fromPrimitives(value: string): ConversationType {
    const type = values.find((candidate) => candidate === value);

    if (!type) throw new ValueNotInEnumError(value, values);

    return new ConversationType(type);
  }

  private constructor(value: (typeof values)[number]) {
    super(value);
  }

  public getValues(): Array<(typeof values)[number]> {
    return [...values];
  }

  public isGroup(): boolean {
    return this.isEqual(ConversationType.GROUP);
  }
}
