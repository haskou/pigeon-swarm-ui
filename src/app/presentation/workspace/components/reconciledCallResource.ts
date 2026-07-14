import type {
  CallResource,
  CallResourceParticipant,
} from '../../../../contexts/calls/domain/callSession.types';

export function reconciledCallResource(
  previous: CallResource | undefined,
  incoming: CallResource,
): CallResource {
  if (!previous || previous.id !== incoming.id) return incoming;

  const previousParticipants = new Map(
    previous.participants.map((participant) => [
      participant.identityId,
      participant,
    ]),
  );
  const participants = incoming.participants.map((participant) => {
    const previousParticipant = previousParticipants.get(
      participant.identityId,
    );

    previousParticipants.delete(participant.identityId);

    if (!previousParticipant) return participant;

    return participantRecordedAt(participant) >=
      participantRecordedAt(previousParticipant)
      ? participant
      : previousParticipant;
  });

  return {
    ...incoming,
    participantIds: Array.from(
      new Set([...incoming.participantIds, ...previous.participantIds]),
    ),
    participants: [...participants, ...previousParticipants.values()],
  };
}

function participantRecordedAt(
  participant: CallResourceParticipant | undefined,
): number {
  if (!participant) return 0;

  return Math.max(
    participant.declinedAt ?? 0,
    participant.joinedAt ?? 0,
    participant.lastHeartbeatAt ?? 0,
    participant.leftAt ?? 0,
    participant.missedAt ?? 0,
  );
}
