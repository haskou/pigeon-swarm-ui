import type {
  CallParticipantMediaConnection,
  CallResource,
} from '../../../../contexts/calls/domain/callSession.types';
import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/RealtimeGateway';

import { numberAttribute, stringAttribute } from './realtimeEventAttributes';

export function callResourceWithParticipantLeaseUpdate(
  call: CallResource | undefined,
  event: RealtimeDomainEvent,
): CallResource | undefined {
  if (!call || event.type !== 'calls.v1.participant_lease.was_updated') {
    return undefined;
  }

  const callId = stringAttribute(event, 'callId');
  const participantIdentityId = stringAttribute(
    event,
    'participantIdentityId',
  );
  const connectionStatus = stringAttribute(event, 'status');
  const lastHeartbeatAt = numberAttribute(event, 'lastHeartbeatAt');

  if (
    call.id !== callId ||
    !participantIdentityId ||
    (connectionStatus !== 'connected' && connectionStatus !== 'disconnected') ||
    lastHeartbeatAt === undefined
  ) {
    return undefined;
  }

  const participantIds = stringArrayAttribute(event, 'participantIds');
  const currentParticipant = call.participants.find(
    (participant) => participant.identityId === participantIdentityId,
  );

  if (!currentParticipant && !participantIds?.includes(participantIdentityId)) {
    return undefined;
  }

  const mediaConnections = mediaConnectionsAttribute(event);
  const updatedParticipant: CallResource['participants'][number] = {
    ...(currentParticipant ?? {
      identityId: participantIdentityId,
      status: 'joined',
    }),
    connected: connectionStatus === 'connected',
    lastHeartbeatAt,
    mediaConnections:
      connectionStatus === 'disconnected'
        ? []
        : (mediaConnections ?? currentParticipant?.mediaConnections ?? []),
  };

  return {
    ...call,
    participantIds: participantIds ?? call.participantIds,
    participants: currentParticipant
      ? call.participants.map((participant) =>
          participant.identityId === participantIdentityId
            ? updatedParticipant
            : participant,
        )
      : [...call.participants, updatedParticipant],
  };
}

function stringArrayAttribute(
  event: RealtimeDomainEvent,
  key: string,
): string[] | undefined {
  const value = event.attributes[key];

  return Array.isArray(value) &&
    value.every((item): item is string => typeof item === 'string')
    ? value
    : undefined;
}

function mediaConnectionsAttribute(
  event: RealtimeDomainEvent,
): CallParticipantMediaConnection[] | undefined {
  const value = event.attributes.mediaConnections;

  if (!Array.isArray(value)) return undefined;

  const connections = value.map(mediaConnection).filter(Boolean);

  return connections.length === value.length
    ? (connections as CallParticipantMediaConnection[])
    : undefined;
}

function mediaConnection(value: unknown): CallParticipantMediaConnection | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const connection = value as Record<string, unknown>;

  if (
    typeof connection.remoteIdentityId !== 'string' ||
    !peerConnectionState(connection.state)
  ) {
    return null;
  }

  return {
    localCandidateType: candidateType(connection.localCandidateType),
    protocol:
      typeof connection.protocol === 'string' ? connection.protocol : undefined,
    relayProtocol:
      typeof connection.relayProtocol === 'string'
        ? connection.relayProtocol
        : undefined,
    relayUrl:
      typeof connection.relayUrl === 'string' ? connection.relayUrl : undefined,
    remoteCandidateType: candidateType(connection.remoteCandidateType),
    remoteIdentityId: connection.remoteIdentityId,
    state: connection.state,
    usesRelay:
      typeof connection.usesRelay === 'boolean'
        ? connection.usesRelay
        : undefined,
  };
}

function candidateType(
  value: unknown,
): CallParticipantMediaConnection['localCandidateType'] {
  return value === 'host' ||
    value === 'prflx' ||
    value === 'relay' ||
    value === 'srflx'
    ? value
    : undefined;
}

function peerConnectionState(value: unknown): value is RTCPeerConnectionState {
  return (
    value === 'closed' ||
    value === 'connected' ||
    value === 'connecting' ||
    value === 'disconnected' ||
    value === 'failed' ||
    value === 'new'
  );
}
