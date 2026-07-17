import type { CallParticipant } from '../../../../../contexts/calls/presentation/view-models/CallParticipant';
import type { CallSession } from '../../../../../contexts/calls/presentation/view-models/CallSession';

import {
  callParticipantConnectionQuality,
  callParticipantConnectionStatus,
} from '../../../../../contexts/calls/presentation/view-models/CallParticipantConnectionQuality';

const remoteParticipant: CallParticipant = {
  identityId: 'remote-identity-id',
  muted: false,
  name: 'Remote participant',
  status: 'joined',
};
const call = {
  currentIdentityId: 'current-identity-id',
  status: 'live',
} as CallSession;

describe('CallParticipantConnectionQuality', () => {
  it('reports disconnected peers as disconnected instead of poor quality', () => {
    const participant: CallParticipant = {
      ...remoteParticipant,
      connectionState: 'disconnected',
    };

    expect(callParticipantConnectionStatus(participant, call)).toBe(
      'disconnected',
    );
    expect(callParticipantConnectionQuality(participant, call)).toBe(
      'disconnected',
    );
  });

  it('reports joined peers without a connection as connecting', () => {
    expect(callParticipantConnectionQuality(remoteParticipant, call)).toBe(
      'connecting',
    );
  });

  it('reports packet loss as poor only after a connection is established', () => {
    const participant: CallParticipant = {
      ...remoteParticipant,
      connectionState: 'connected',
      packetsLost: 20,
    };

    expect(callParticipantConnectionQuality(participant, call)).toBe('poor');
  });
});
