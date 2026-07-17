import { StringValueObject } from '@haskou/value-objects';

export class CommunityMediaIdentifier extends StringValueObject {
  public static fromOptional(value?: null | string): CommunityMediaIdentifier {
    return new CommunityMediaIdentifier(value?.trim() ?? '');
  }

  private constructor(value: string) {
    super(value);
  }

  public isPresent(): boolean {
    return !this.isEmpty();
  }
}
