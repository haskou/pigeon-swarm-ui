import type { CallRepository } from '../../../../contexts/calls/domain/repositories/CallRepository';
import type { CallSignalRepository } from '../../../../contexts/calls/domain/repositories/CallSignalRepository';

import { CallEnder } from '../../../../contexts/calls/application/end-call/CallEnder';
import { EndCallMessage } from '../../../../contexts/calls/application/end-call/messages/EndCallMessage';
import { CallFinder } from '../../../../contexts/calls/application/find-call/CallFinder';
import { FindCallMessage } from '../../../../contexts/calls/application/find-call/messages/FindCallMessage';
import { CallParticipantHeartbeater } from '../../../../contexts/calls/application/heartbeat-participant/CallParticipantHeartbeater';
import { HeartbeatCallParticipantMessage } from '../../../../contexts/calls/application/heartbeat-participant/messages/HeartbeatCallParticipantMessage';
import { CallJoiner } from '../../../../contexts/calls/application/join-call/CallJoiner';
import { JoinCallMessage } from '../../../../contexts/calls/application/join-call/messages/JoinCallMessage';
import { CallLeaver } from '../../../../contexts/calls/application/leave-call/CallLeaver';
import { LeaveCallMessage } from '../../../../contexts/calls/application/leave-call/messages/LeaveCallMessage';
import { CallsSearcher } from '../../../../contexts/calls/application/search-calls/CallsSearcher';
import { SearchCallsMessage } from '../../../../contexts/calls/application/search-calls/messages/SearchCallsMessage';
import { CallSignalSender } from '../../../../contexts/calls/application/send-call-signal/CallSignalSender';
import { SendCallSignalMessage } from '../../../../contexts/calls/application/send-call-signal/messages/SendCallSignalMessage';
import { CommunityChannelCallStarter } from '../../../../contexts/calls/application/start-community-channel-call/CommunityChannelCallStarter';
import { StartCommunityChannelCallMessage } from '../../../../contexts/calls/application/start-community-channel-call/messages/StartCommunityChannelCallMessage';
import { ConversationCallStarter } from '../../../../contexts/calls/application/start-conversation-call/ConversationCallStarter';
import { StartConversationCallMessage } from '../../../../contexts/calls/application/start-conversation-call/messages/StartConversationCallMessage';
import { Call } from '../../../../contexts/calls/domain/Call';
import { CallSignalDelivery } from '../../../../contexts/calls/domain/entities/CallSignalDelivery';
import { CallId } from '../../../../contexts/calls/domain/value-objects/CallId';
import { CallIdentityId } from '../../../../contexts/calls/domain/value-objects/CallIdentityId';
import { CallParticipantStatus } from '../../../../contexts/calls/domain/value-objects/CallParticipantStatus';

const actorId = CallIdentityId.fromString('identity-a');

const callFixture = (): Call =>
  Call.fromPrimitives({
    createdAt: 1,
    creatorIdentityId: 'identity-a',
    endedAt: undefined,
    id: 'call-a',
    networkId: 'network-a',
    participantIds: ['identity-a'],
    participants: [
      {
        connected: false,
        identityId: 'identity-a',
        mediaConnections: [],
        status: 'ringing',
      },
    ],
    scope: { conversationId: 'conversation-a', type: 'conversation' },
    status: 'active',
  });

describe('call application use cases', () => {
  let calls: jest.Mocked<CallRepository>;

  beforeEach(() => {
    calls = {
      create: jest.fn(),
      end: jest.fn(),
      find: jest.fn(),
      heartbeat: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
      search: jest.fn(),
    };
  });

  it('finds and searches calls through the repository', async () => {
    const call = callFixture();
    calls.find.mockResolvedValue(call);
    calls.search.mockResolvedValue([call]);

    await expect(
      new CallFinder(calls).find(new FindCallMessage('call-a', 'identity-a')),
    ).resolves.toBe(call);
    await expect(
      new CallsSearcher(calls).search(new SearchCallsMessage('identity-a')),
    ).resolves.toEqual([call]);
    expect(calls.find).toHaveBeenCalledWith(
      CallId.fromString('call-a'),
      actorId,
    );
    expect(calls.search).toHaveBeenCalledWith(actorId);
  });

  it('starts conversation and community channel calls from domain scopes', async () => {
    const call = callFixture();
    calls.create.mockResolvedValue(call);

    await new ConversationCallStarter(calls).start(
      new StartConversationCallMessage('conversation-a', 'identity-a'),
    );
    await new CommunityChannelCallStarter(calls).start(
      new StartCommunityChannelCallMessage(
        'community-a',
        'channel-a',
        'identity-a',
      ),
    );

    expect(calls.create.mock.calls[0]?.[0].toPrimitives()).toEqual({
      conversationId: 'conversation-a',
      type: 'conversation',
    });
    expect(calls.create.mock.calls[1]?.[0].toPrimitives()).toEqual({
      channelId: 'channel-a',
      communityId: 'community-a',
      type: 'community_channel',
    });
  });

  it('mutates the aggregate before joining, leaving, ending, and heartbeating', async () => {
    const joined = callFixture();
    calls.find.mockResolvedValueOnce(joined);
    calls.join.mockResolvedValue(joined);
    await new CallJoiner(calls).join(
      new JoinCallMessage('call-a', 'identity-a', 10),
    );
    expect(
      joined.hasParticipantStatus(actorId, CallParticipantStatus.JOINED),
    ).toBe(true);

    const heartbeat = callFixture();
    calls.find.mockResolvedValueOnce(heartbeat);
    calls.heartbeat.mockResolvedValue(heartbeat);
    await new CallParticipantHeartbeater(calls).heartbeat(
      new HeartbeatCallParticipantMessage({
        actorIdentityId: 'identity-a',
        callId: 'call-a',
        mediaConnections: [],
        occurredAt: 20,
      }),
    );
    expect(heartbeat.toPrimitives().participants[0]?.lastHeartbeatAt).toBe(20);

    const left = callFixture();
    calls.find.mockResolvedValueOnce(left);
    await new CallLeaver(calls).leave(
      new LeaveCallMessage('call-a', 'identity-a', 30),
    );
    expect(left.toPrimitives().participants[0]?.status).toBe('left');

    const ended = callFixture();
    calls.find.mockResolvedValueOnce(ended);
    await new CallEnder(calls).end(
      new EndCallMessage('call-a', 'identity-a', 40),
    );
    expect(ended.toPrimitives().status).toBe('ended');
  });

  it('sends a validated domain signal through the outbound transmitter', async () => {
    const delivery = CallSignalDelivery.fromPrimitives({
      expiresAt: 100,
      signalId: 'signal-a',
    });
    const repository: jest.Mocked<CallSignalRepository> = {
      create: jest.fn().mockResolvedValue(delivery),
    };

    await expect(
      new CallSignalSender(repository).send(
        new SendCallSignalMessage({
          actorIdentityId: 'identity-a',
          callId: 'call-a',
          payload: { sdp: 'offer' },
          recipientIdentityId: 'identity-b',
          signalType: 'offer',
        }),
      ),
    ).resolves.toBe(delivery);
    expect(repository.create.mock.calls[0]?.[2].toPrimitives()).toEqual({
      payload: { sdp: 'offer' },
      recipientIdentityId: 'identity-b',
      signalType: 'offer',
    });
  });
});
