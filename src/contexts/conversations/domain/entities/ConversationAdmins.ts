import { ConversationParticipantId } from '../value-objects/ConversationParticipantId';

/** Admins of a group. The creator is never one of them. */
export class ConversationAdmins {
  public static fromPrimitives(values: string[]): ConversationAdmins {
    return new ConversationAdmins(
      values.map(ConversationParticipantId.fromString),
    );
  }

  private constructor(private admins: ConversationParticipantId[]) {}

  public add(participantId: ConversationParticipantId): void {
    if (this.includes(participantId)) return;

    this.admins.push(participantId);
  }

  public includes(participantId: ConversationParticipantId): boolean {
    return this.admins.some((candidate) => candidate.isEqual(participantId));
  }

  public remove(participantId: ConversationParticipantId): void {
    this.admins = this.admins.filter((candidate) =>
      candidate.isNotEqual(participantId),
    );
  }

  public toPrimitives() {
    return this.admins.map((admin) => admin.toString());
  }
}
