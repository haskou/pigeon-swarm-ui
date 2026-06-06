import { StringValueObject } from '@haskou/value-objects';

export class ConversationId extends StringValueObject {
  public static fromString(value: string): ConversationId {
    return new ConversationId(value);
  }

  private constructor(value: string) {
    super(value.trim());
  }

  public isGroupConversation(): boolean {
    return this.toString().startsWith('group:');
  }
}
