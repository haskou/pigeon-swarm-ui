import type { CallResource } from '../../../../../contexts/calls/domain/callSession.types';

import {
  joinedRemotePeerIdentityIds,
  participantJoinWasAccepted,
  retainedRemotePeerIdentityIds,
  signalingRemotePeerIdentityIds,
  shouldCreateInitialOffer,
} from '../../../../../contexts/calls/presentation/hooks/callPeerConnectionPlan';

describe('callPeerConnectionPlan', () => {
  it('uses connected participants from the call resource even when UI participants are not hydrated yet', () => {
    const call = callResource({
      currentIdentityId: 'alice',
      remoteIdentityId: 'bob',
    });

    expect(joinedRemotePeerIdentityIds(call, 'alice')).toEqual(['bob']);
  });

  it('accepts a joined participant before its first heartbeat lease connects', () => {
    const call = callResource({
      currentIdentityId: 'alice',
      remoteIdentityId: 'bob',
    });

    call.participants[0].connected = false;

    expect(participantJoinWasAccepted(call, 'alice')).toBe(true);
  });

  it('does not connect ringing or left participants', () => {
    const call = callResource({
      currentIdentityId: 'alice',
      remoteIdentityId: 'bob',
    });

    call.participants.push(
      {
        connected: false,
        identityId: 'carol',
        mediaConnections: [],
        status: 'ringing',
      },
      {
        connected: false,
        identityId: 'den',
        mediaConnections: [],
        status: 'left',
      },
      {
        connected: false,
        identityId: 'eve',
        mediaConnections: [],
        status: 'joined',
      },
    );

    expect(joinedRemotePeerIdentityIds(call, 'alice')).toEqual(['bob']);
  });

  it('signals only participants with an active backend lease', () => {
    const call = callResource({
      currentIdentityId: 'alice',
      remoteIdentityId: 'bob',
    });

    call.participants.push(
      {
        connected: false,
        identityId: 'carol',
        mediaConnections: [],
        status: 'ringing',
      },
      {
        connected: false,
        identityId: 'den',
        mediaConnections: [],
        status: 'left',
      },
      {
        connected: false,
        identityId: 'eve',
        mediaConnections: [],
        status: 'declined',
      },
      {
        connected: false,
        identityId: 'frank',
        mediaConnections: [],
        status: 'missed',
      },
    );

    expect(signalingRemotePeerIdentityIds(call, 'alice')).toEqual(['bob']);
  });

  it('retains a joined peer while its backend lease reconnects', () => {
    const call = callResource({
      currentIdentityId: 'alice',
      remoteIdentityId: 'bob',
    });

    call.participants[1].connected = false;

    expect(signalingRemotePeerIdentityIds(call, 'alice')).toEqual([]);
    expect(retainedRemotePeerIdentityIds(call, 'alice')).toEqual(['bob']);
  });

  it('releases peers that have left the call', () => {
    const call = callResource({
      currentIdentityId: 'alice',
      remoteIdentityId: 'bob',
    });

    call.participants[1].connected = false;
    call.participants[1].status = 'left';

    expect(retainedRemotePeerIdentityIds(call, 'alice')).toEqual([]);
  });

  it('chooses a stable initial offerer for both peers', () => {
    expect(shouldCreateInitialOffer('alice', 'bob')).toBe(true);
    expect(shouldCreateInitialOffer('bob', 'alice')).toBe(false);
  });
});

function callResource({
  currentIdentityId,
  remoteIdentityId,
}: {
  currentIdentityId: string;
  remoteIdentityId: string;
}): CallResource {
  return {
    createdAt: 1_780_000_000_000,
    creatorIdentityId: currentIdentityId,
    id: 'call-1',
    networkId: 'network-1',
    participantIds: [currentIdentityId, remoteIdentityId],
    participants: [
      {
        connected: true,
        identityId: currentIdentityId,
        joinedAt: 1_780_000_000_000,
        mediaConnections: [],
        status: 'joined',
      },
      {
        connected: true,
        identityId: remoteIdentityId,
        joinedAt: 1_780_000_000_001,
        mediaConnections: [],
        status: 'joined',
      },
    ],
    scope: {
      conversationId: 'one-to-one:alice:bob',
      type: 'conversation',
    },
    status: 'active',
  };
}
