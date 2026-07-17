import { Timestamp } from '@haskou/value-objects';

import { Call } from '../../../../../contexts/calls/domain/Call';
import { CallIdentityId } from '../../../../../contexts/calls/domain/value-objects/CallIdentityId';
import { CallParticipantStatus } from '../../../../../contexts/calls/domain/value-objects/CallParticipantStatus';

const identityA = CallIdentityId.fromString('identity-a');
const identityB = CallIdentityId.fromString('identity-b');

const activeCall = (): Call =>
  Call.fromPrimitives({
    createdAt: 100,
    creatorIdentityId: 'identity-a',
    endedAt: undefined,
    id: 'call-a',
    networkId: 'network-a',
    participantIds: ['identity-a', 'identity-b'],
    participants: [
      {
        connected: true,
        identityId: 'identity-a',
        mediaConnections: [],
        status: 'joined',
      },
      {
        connected: false,
        identityId: 'identity-b',
        mediaConnections: [],
        status: 'ringing',
      },
    ],
    scope: { conversationId: 'conversation-a', type: 'conversation' },
    status: 'active',
  });

describe(Call.name, () => {
  it('joins a ringing participant and records the transition', () => {
    const call = activeCall();

    call.joinParticipant(identityB, new Timestamp(200));

    expect(
      call.hasParticipantStatus(identityB, CallParticipantStatus.JOINED),
    ).toBe(true);
    expect(call.pullDomainEvents()).toEqual([
      {
        aggregateId: 'call-a',
        occurredAt: 200,
        type: 'CallParticipantJoined',
      },
    ]);
  });

  it('ends an active call only once', () => {
    const call = activeCall();

    call.end(new Timestamp(250));
    call.end(new Timestamp(300));

    expect(call.toPrimitives().status).toBe('ended');
    expect(call.toPrimitives().endedAt).toBe(250);
    expect(call.pullDomainEvents()).toHaveLength(1);
  });

  it('updates participant presence through the aggregate', () => {
    const call = activeCall();

    call.heartbeatParticipant(identityA, new Timestamp(400), []);
    call.leaveParticipant(identityA, new Timestamp(500));

    const participant = call
      .toPrimitives()
      .participants.find(({ identityId }) => identityId === 'identity-a');

    expect(participant).toMatchObject({
      connected: false,
      lastHeartbeatAt: 400,
      leftAt: 500,
      status: 'left',
    });
  });
});
