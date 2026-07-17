import { StringValueObject } from '@haskou/value-objects';

export class ConversationPreview extends StringValueObject {
  public static fromOptional(value?: string): ConversationPreview {
    return new ConversationPreview(value ?? '');
  }

  private constructor(value: string) {
    super(value, Number.MAX_SAFE_INTEGER);
  }

  public isPresent(): boolean {
    return !this.isEmpty();
  }
}
