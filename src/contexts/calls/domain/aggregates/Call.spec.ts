import { Timestamp } from '@haskou/value-objects';

import type { CallResource } from '../callSession.types';

import { CallIdentityId } from '../value-objects/CallIdentityId';
import { Call } from './Call';

const callResource = (overrides: Partial<CallResource> = {}): CallResource => ({
  createdAt: 100,
  creatorIdentityId: 'identity-a',
  id: 'call-a',
  networkId: 'network-a',
  participantIds: ['identity-a', 'identity-b'],
  participants: [
    { connected: true, identityId: 'identity-a', status: 'joined' },
    { connected: false, identityId: 'identity-b', status: 'ringing' },
  ],
  scope: { conversationId: 'conversation-a', type: 'conversation' },
  status: 'active',
  ...overrides,
});

describe('Call', () => {
  it('joins a ringing participant through the call aggregate', () => {
    const call = Call.fromResource(callResource());
    const participantId = CallIdentityId.fromString('identity-b');

    call.joinParticipant(participantId, new Timestamp(200));

    expect(call.hasParticipantStatus(participantId, 'joined')).toBe(true);
    expect(
      call
        .toResource()
        .participants.find(
          (participant) => participant.identityId === 'identity-b',
        )?.connected,
    ).toBe(true);
    expect(call.pullDomainEvents()).toHaveLength(1);
  });

  it('ends an active call once', () => {
    const call = Call.fromResource(callResource());

    call.end(new Timestamp(250));
    call.end(new Timestamp(300));

    expect(call.toResource().status).toBe('ended');
    expect(call.pullDomainEvents()).toHaveLength(1);
  });
});
