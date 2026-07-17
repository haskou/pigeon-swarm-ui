import type { CallParticipant } from '../view-models/CallParticipant';
import type { CallResource } from '../../infrastructure/http/resources/CallResource';

export function reconciledCallParticipants(
  currentParticipants: CallParticipant[],
  incomingParticipants: CallParticipant[],
  call: CallResource,
): CallParticipant[] {
  const currentByIdentityId = new Map(
    currentParticipants.map((participant) => [
      participant.identityId,
      participant,
    ]),
  );
  const resourceByIdentityId = new Map(
    call.participants.map((participant) => [
      participant.identityId,
      participant,
    ]),
  );

  return incomingParticipants.map((participant) => {
    const current = currentByIdentityId.get(participant.identityId);
    const resource = resourceByIdentityId.get(participant.identityId);

    return {
      ...participant,
      ...current,
      connected: resource?.connected ?? current?.connected,
      identity: participant.identity ?? current?.identity,
      lastHeartbeatAt: resource?.lastHeartbeatAt ?? current?.lastHeartbeatAt,
      mediaConnections: resource?.mediaConnections ?? current?.mediaConnections,
      name: participant.name,
      picture: participant.picture,
      status: resource?.status ?? current?.status ?? participant.status,
    };
  });
}
