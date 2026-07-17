import { StringValueObject, assert } from '@haskou/value-objects';

import { ConversationParticipantIdRequiredError } from '../errors/ConversationParticipantIdRequiredError';

export class ConversationParticipantId extends StringValueObject {
  private static normalize(value: string): string {
    const trimmedValue = value.trim();

    if (!trimmedValue.includes('-----BEGIN PUBLIC KEY-----')) {
      return trimmedValue;
    }

    return trimmedValue
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s+/g, '');
  }

  public static fromString(value: string): ConversationParticipantId {
    return new ConversationParticipantId(
      ConversationParticipantId.normalize(value),
    );
  }

  private constructor(value: string) {
    super(value);
    assert(!this.isEmpty(), new ConversationParticipantIdRequiredError());
  }

  public orderedWith(
    participantId: ConversationParticipantId,
  ): [ConversationParticipantId, ConversationParticipantId] {
    return this.value.localeCompare(participantId.value) <= 0
      ? [this, participantId]
      : [participantId, this];
  }
}
