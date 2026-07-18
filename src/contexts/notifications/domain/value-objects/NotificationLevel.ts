import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

const values = ['all', 'mentions', 'none'] as const;

export class NotificationLevel extends Enum<(typeof values)[number]> {
  public static readonly ALL = new NotificationLevel('all');

  public static readonly MENTIONS = new NotificationLevel('mentions');

  public static readonly NONE = new NotificationLevel('none');

  public static fromPrimitives(value: string): NotificationLevel {
    const level = values.find((candidate) => candidate === value);

    if (!level) throw new ValueNotInEnumError(value, values);

    return new NotificationLevel(level);
  }

  private constructor(value: (typeof values)[number]) {
    super(value);
  }

  public getValues(): Array<(typeof values)[number]> {
    return [...values];
  }

  public includesAll(): boolean {
    return this.isEqual(NotificationLevel.ALL);
  }

  public includesMentions(): boolean {
    return this.isEqual(NotificationLevel.MENTIONS);
  }

  public silencesAll(): boolean {
    return this.isEqual(NotificationLevel.NONE);
  }
}
