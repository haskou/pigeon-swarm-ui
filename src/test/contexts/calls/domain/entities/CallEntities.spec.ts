import { CallMediaConnection } from '../../../../../contexts/calls/domain/entities/CallMediaConnection';
import { CallParticipant } from '../../../../../contexts/calls/domain/entities/CallParticipant';
import { CallSignalDelivery } from '../../../../../contexts/calls/domain/entities/CallSignalDelivery';
import { CallConnectionRoute } from '../../../../../contexts/calls/domain/value-objects/CallConnectionRoute';

describe('call entities hydration', () => {
  it('hydrates and serializes a participant with its media connections', () => {
    const participant = CallParticipant.fromPrimitives({
      connected: true,
      identityId: 'identity-a',
      joinedAt: 100,
      lastHeartbeatAt: 200,
      mediaConnections: [
        {
          localCandidateType: 'relay',
          protocol: 'udp',
          remoteIdentityId: 'identity-b',
          state: 'connected',
          usesRelay: true,
        },
      ],
      status: 'joined',
    });

    expect(participant.toPrimitives()).toEqual({
      connected: true,
      identityId: 'identity-a',
      joinedAt: 100,
      lastHeartbeatAt: 200,
      mediaConnections: [
        {
          localCandidateType: 'relay',
          protocol: 'udp',
          remoteIdentityId: 'identity-b',
          state: 'connected',
          usesRelay: true,
        },
      ],
      status: 'joined',
    });
  });

  it('hydrates and serializes media connection routing data', () => {
    const connection = CallMediaConnection.fromPrimitives({
      localCandidateType: 'host',
      relayProtocol: 'turn',
      relayUrl: 'turn:relay.example.test',
      remoteCandidateType: 'relay',
      remoteIdentityId: 'identity-b',
      state: 'connected',
      usesRelay: true,
    });

    expect(connection.toPrimitives()).toEqual({
      localCandidateType: 'host',
      relayProtocol: 'turn',
      relayUrl: 'turn:relay.example.test',
      remoteCandidateType: 'relay',
      remoteIdentityId: 'identity-b',
      state: 'connected',
      usesRelay: true,
    });
  });

  it('keeps the media route as one cohesive value', () => {
    const route = CallConnectionRoute.fromPrimitives({
      localCandidateType: 'host',
      protocol: 'udp',
      relayProtocol: 'turn',
      relayUrl: 'turn:relay.example.test',
      remoteCandidateType: 'relay',
      usesRelay: true,
    });

    expect(route.toPrimitives()).toEqual({
      localCandidateType: 'host',
      protocol: 'udp',
      relayProtocol: 'turn',
      relayUrl: 'turn:relay.example.test',
      remoteCandidateType: 'relay',
      usesRelay: true,
    });
  });

  it('hydrates and serializes a signal delivery', () => {
    const delivery = CallSignalDelivery.fromPrimitives({
      expiresAt: 500,
      signalId: 'signal-a',
    });

    expect(delivery.toPrimitives()).toEqual({
      expiresAt: 500,
      signalId: 'signal-a',
    });
  });
});
