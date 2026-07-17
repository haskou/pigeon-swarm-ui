import { StringValueObject, assert } from '@haskou/value-objects';

import type { ConversationType } from './ConversationType';

import { GroupConversationNameRequiredError } from '../errors/GroupConversationNameRequiredError';

export class ConversationName extends StringValueObject {
  public static readonly MAX_LENGTH = 80;

  public static fromOptional(value?: string): ConversationName {
    return new ConversationName(value?.trim() ?? '');
  }

  private constructor(value: string) {
    super(value, ConversationName.MAX_LENGTH);
  }

  public assertPresentFor(type: ConversationType): void {
    assert(
      !type.isGroup() || !this.isEmpty(),
      new GroupConversationNameRequiredError(),
    );
  }

  public isPresent(): boolean {
    return !this.isEmpty();
  }
}
