import type { CallResource } from '../../domain/callSession.types';

import {
  joinedRemotePeerIdentityIds,
  signalingRemotePeerIdentityIds,
  shouldCreateInitialOffer,
} from './callPeerConnectionPlan';

describe('callPeerConnectionPlan', () => {
  it('uses connected participants from the call resource even when UI participants are not hydrated yet', () => {
    const call = callResource({
      currentIdentityId: 'alice',
      remoteIdentityId: 'bob',
    });

    expect(joinedRemotePeerIdentityIds(call, 'alice')).toEqual(['bob']);
  });

  it('does not connect ringing or left participants', () => {
    const call = callResource({
      currentIdentityId: 'alice',
      remoteIdentityId: 'bob',
    });

    call.participants.push(
      { connected: false, identityId: 'carol', status: 'ringing' },
      { connected: false, identityId: 'den', status: 'left' },
      { connected: false, identityId: 'eve', status: 'joined' },
    );

    expect(joinedRemotePeerIdentityIds(call, 'alice')).toEqual(['bob']);
  });

  it('signals only participants with an active backend lease', () => {
    const call = callResource({
      currentIdentityId: 'alice',
      remoteIdentityId: 'bob',
    });

    call.participants.push(
      { connected: false, identityId: 'carol', status: 'ringing' },
      { connected: false, identityId: 'den', status: 'left' },
      { connected: false, identityId: 'eve', status: 'declined' },
      { connected: false, identityId: 'frank', status: 'missed' },
    );

    expect(signalingRemotePeerIdentityIds(call, 'alice')).toEqual(['bob']);
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
        status: 'joined',
      },
      {
        connected: true,
        identityId: remoteIdentityId,
        joinedAt: 1_780_000_000_001,
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
