import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

export class CommunityVisibility extends Enum<'private' | 'public'> {
  private static readonly values: Array<'private' | 'public'> = [
    'private',
    'public',
  ];

  public static readonly PRIVATE = new CommunityVisibility('private');

  public static readonly PUBLIC = new CommunityVisibility('public');

  public static fromPrimitives(value: string): CommunityVisibility {
    const visibility = CommunityVisibility.values.find(
      (candidate) => candidate === value,
    );

    if (!visibility) {
      throw new ValueNotInEnumError(value, CommunityVisibility.values);
    }

    return new CommunityVisibility(visibility);
  }

  private constructor(value: 'private' | 'public') {
    super(value);
  }

  public getValues(): Array<'private' | 'public'> {
    return CommunityVisibility.values;
  }

  public isPublic(): boolean {
    return this.isEqual(CommunityVisibility.PUBLIC);
  }

  public toPrimitives() {
    return this.valueOf();
  }
}
