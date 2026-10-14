import { IdentityMatch } from '../../../identities/domain/IdentityMatch';

type GroupParticipant = { identity: { id: string } };

/** The identities picked for a new group, matched in either id form. */
export class GroupParticipantSelection {
  public static includes(
    participants: readonly GroupParticipant[],
    identityId: string,
  ): boolean {
    return participants.some(({ identity }) =>
      IdentityMatch.isSame(identity.id, identityId),
    );
  }

  public static without<Participant extends GroupParticipant>(
    participants: readonly Participant[],
    identityId: string,
  ): Participant[] {
    return participants.filter(
      ({ identity }) => !IdentityMatch.isSame(identity.id, identityId),
    );
  }
}
