import { assert } from '@haskou/value-objects';

import { ConversationParticipantAlreadyExistsError } from '../errors/ConversationParticipantAlreadyExistsError';
import { ConversationParticipantNotFoundError } from '../errors/ConversationParticipantNotFoundError';
import { ConversationParticipantId } from '../value-objects/ConversationParticipantId';

export class ConversationParticipants {
  public static create(
    participants: ConversationParticipantId[],
  ): ConversationParticipants {
    return new ConversationParticipants(
      participants.filter(
        (participant, index) =>
          participants.findIndex((candidate) =>
            candidate.isEqual(participant),
          ) === index,
      ),
    );
  }

  public static fromPrimitives(values: string[]): ConversationParticipants {
    return new ConversationParticipants(
      values.map(ConversationParticipantId.fromString),
    );
  }

  private constructor(
    private readonly participants: ConversationParticipantId[],
  ) {}

  public add(participantId: ConversationParticipantId): void {
    this.assertExcludes(participantId);
    this.participants.push(participantId);
  }

  public assertExcludes(participantId: ConversationParticipantId): void {
    assert(
      !this.includes(participantId),
      new ConversationParticipantAlreadyExistsError(),
    );
  }

  public assertIncludes(participantId: ConversationParticipantId): void {
    assert(
      this.includes(participantId),
      new ConversationParticipantNotFoundError(),
    );
  }

  public includes(participantId: ConversationParticipantId): boolean {
    return this.participants.some((candidate) =>
      candidate.isEqual(participantId),
    );
  }

  public peerOf(
    participantId: ConversationParticipantId,
    explicitPeerIdentityId?: ConversationParticipantId,
  ): ConversationParticipantId | undefined {
    return (
      explicitPeerIdentityId ??
      this.participants.find((candidate) => candidate.isNotEqual(participantId))
    );
  }

  public toPrimitives() {
    return this.participants.map((participant) => participant.toString());
  }
}
