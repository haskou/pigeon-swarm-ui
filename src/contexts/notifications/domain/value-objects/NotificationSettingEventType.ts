import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

const values = [
  'NotificationSettingSaved',
  'NotificationSettingReset',
] as const;

export class NotificationSettingEventType extends Enum<
  (typeof values)[number]
> {
  public static readonly RESET = new NotificationSettingEventType(
    'NotificationSettingReset',
  );

  public static readonly SAVED = new NotificationSettingEventType(
    'NotificationSettingSaved',
  );

  public static fromPrimitives(value: string): NotificationSettingEventType {
    const type = values.find((candidate) => candidate === value);

    if (!type) throw new ValueNotInEnumError(value, values);

    return new NotificationSettingEventType(type);
  }

  private constructor(value: (typeof values)[number]) {
    super(value);
  }

  public getValues(): Array<(typeof values)[number]> {
    return [...values];
  }
}
