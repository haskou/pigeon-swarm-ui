import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

const values = [
  'community_invitation',
  'conversation_invitation',
  'group_conversation_invitation',
  'missed_call',
] as const;

export class NotificationType extends Enum<(typeof values)[number]> {
  public static fromPrimitives(value: string): NotificationType {
    const type = values.find((candidate) => candidate === value);

    if (!type) throw new ValueNotInEnumError(value, values);

    return new NotificationType(type);
  }

  private constructor(value: (typeof values)[number]) {
    super(value);
  }

  public getValues(): Array<(typeof values)[number]> {
    return [...values];
  }

  public isActionable(): boolean {
    return !this.isEqual(new NotificationType('missed_call'));
  }
}
