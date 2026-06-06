import { StringValueObject } from '@haskou/value-objects';

export class ConversationId extends StringValueObject {
  private constructor(value: string) {
    super(value.trim());
  }

  public static fromString(value: string): ConversationId {
    return new ConversationId(value);
  }

  public isGroupConversation(): boolean {
    return this.toString().startsWith('group:');
  }
}
