import { SHA256Hash, ShortId } from '@haskou/value-objects';

import { ConversationId } from './value-objects/ConversationId';
import { ConversationNetworkId } from './value-objects/ConversationNetworkId';
import { ConversationParticipantId } from './value-objects/ConversationParticipantId';

export class ConversationIdFactory {
  public createGroup(): ConversationId {
    return ConversationId.fromString(`group:${ShortId.generate().toString()}`);
  }

  public create(
    leftIdentityId: ConversationParticipantId,
    rightIdentityId: ConversationParticipantId,
    networkId: ConversationNetworkId,
  ): ConversationId {
    const sorted = leftIdentityId
      .orderedWith(rightIdentityId)
      .map((identityId) => identityId.toString())
      .join(':');

    return ConversationId.fromString(
      `one-to-one:${SHA256Hash.from(
        `${sorted}:${networkId.toString()}`,
      ).toString()}`,
    );
  }
}
