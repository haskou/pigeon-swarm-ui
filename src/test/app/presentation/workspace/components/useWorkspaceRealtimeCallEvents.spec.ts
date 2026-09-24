import type { CallResource } from '../../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { Session } from '../../../../../shared/domain/pigeonResources.types';
import type { RealtimeDomainEvent } from '../../../../../shared/infrastructure/realtime/RealtimeGateway';

import { applicationContainer } from '../../../../../app/composition/applicationContainer';
import { useWorkspaceRealtimeCallEvents } from '../../../../../app/presentation/workspace/components/useWorkspaceRealtimeCallEvents';

jest.mock('react', () => ({
  useCallback: (callback: unknown) => callback,
  useEffect: () => undefined,
  useRef: (current: unknown) => ({ current }),
}));
jest.mock('../../../../../app/composition/applicationContainer', () => ({
  applicationContainer: { calls: { get: jest.fn(), list: jest.fn() } },
}));
jest.mock('../../../../../app/presentation/realtime/useRealtimeEvents', () => ({
  acknowledgeRealtimeCallSignal: jest.fn(),
}));
jest.mock(
  '../../../../../contexts/calls/infrastructure/media/callDebugLogger',
  () => ({ logCallDebug: jest.fn(), logCallError: jest.fn() }),
);

function malformedEvent(revision: number): RealtimeDomainEvent {
  return {
    aggregate_id: 'call-a',
    attributes: { callId: 'call-a', liveCall: {}, liveCallRevision: revision },
    causation_id: '',
    correlation_id: '',
    event_id: String(revision),
    occurred_on: revision,
    type: 'calls.v1.participant.joined',
  };
}

function validEvent(
  revision: number,
  participantIds: string[],
): RealtimeDomainEvent {
  const event = malformedEvent(revision);
  event.attributes.liveCall = {
    id: 'call-a',
    networkId: 'network-a',
    participantIds,
    participants: participantIds.map((identityId) => ({
      connected: true,
      identityId,
      mediaConnections: [],
      status: 'joined',
    })),
    scope: {
      channelId: 'channel-a',
      communityId: 'community-a',
      type: 'community_channel',
    },
    status: 'active',
  };

  return event;
}

describe('workspace malformed snapshot recovery', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(applicationContainer.calls.get).mockReset();
    jest.mocked(applicationContainer.calls.list).mockReset();
  });
  afterEach(() => jest.useRealTimers());

  it.each(['before', 'after'])(
    'ignores an older valid snapshot arriving %s malformed snapshot recovery completes',
    async (timing) => {
      const get = jest.mocked(applicationContainer.calls.get);
      let resolveRecovery: (value: CallResource) => void = () => undefined;
      get.mockReturnValue(
        new Promise((resolve) => {
          resolveRecovery = resolve;
        }),
      );
      const reconcile = jest.fn();
      const handlers = useWorkspaceRealtimeCallEvents({
        activeCallRef: { current: null },
        onRecoveredCalls: jest.fn(),
        receiveSignal: () => Promise.resolve(),
        reconcileCallResource: reconcile,
        sessionRef: { current: { identity: { id: 'alice' } } as Session },
      });
      const recovered = validEvent(3, ['alice']).attributes
        .liveCall as CallResource;
      handlers.handleRealtimeCallEvent(malformedEvent(3));

      if (timing === 'before') {
        handlers.handleRealtimeCallEvent(validEvent(2, ['alice', 'bob']));
        expect(reconcile).not.toHaveBeenCalled();
      }
      resolveRecovery(recovered);
      await jest.advanceTimersByTimeAsync(0);

      if (timing === 'after') {
        handlers.handleRealtimeCallEvent(validEvent(2, ['alice', 'bob']));
      }
      expect(reconcile).toHaveBeenCalledTimes(1);
      expect(reconcile).toHaveBeenLastCalledWith(recovered);
      handlers.handleRealtimeCallEvent(validEvent(4, ['alice', 'charlie']));
      expect(reconcile).toHaveBeenLastCalledWith(
        expect.objectContaining({ participantIds: ['alice', 'charlie'] }),
      );
      await jest.advanceTimersByTimeAsync(10000);
      expect(get).toHaveBeenCalledTimes(1);
    },
  );

  it.each([3, 4])(
    'keeps a valid revision %s received during recovery of malformed revision 3',
    async (revision) => {
      let resolveRecovery: (value: CallResource) => void = () => undefined;
      jest.mocked(applicationContainer.calls.get).mockReturnValue(
        new Promise((resolve) => {
          resolveRecovery = resolve;
        }),
      );
      const reconcile = jest.fn();
      const handlers = useWorkspaceRealtimeCallEvents({
        activeCallRef: { current: null },
        onRecoveredCalls: jest.fn(),
        receiveSignal: () => Promise.resolve(),
        reconcileCallResource: reconcile,
        sessionRef: { current: { identity: { id: 'alice' } } as Session },
      });
      handlers.handleRealtimeCallEvent(malformedEvent(3));
      handlers.handleRealtimeCallEvent(validEvent(revision, ['charlie']));
      resolveRecovery(
        validEvent(3, ['alice']).attributes.liveCall as CallResource,
      );
      await jest.advanceTimersByTimeAsync(0);
      expect(reconcile).toHaveBeenCalledTimes(1);
      expect(reconcile).toHaveBeenLastCalledWith(
        expect.objectContaining({ participantIds: ['charlie'] }),
      );
    },
  );

  it('clears the malformed revision floor when the connection generation resets', async () => {
    jest
      .mocked(applicationContainer.calls.get)
      .mockReturnValue(new Promise(() => undefined));
    jest.mocked(applicationContainer.calls.list).mockResolvedValue([]);
    const reconcile = jest.fn();
    const handlers = useWorkspaceRealtimeCallEvents({
      activeCallRef: { current: null },
      onRecoveredCalls: jest.fn(),
      receiveSignal: () => Promise.resolve(),
      reconcileCallResource: reconcile,
      sessionRef: { current: { identity: { id: 'alice' } } as Session },
    });
    handlers.handleRealtimeCallEvent(malformedEvent(9));
    handlers.recoverRealtimeCalls();
    await jest.advanceTimersByTimeAsync(0);
    handlers.handleRealtimeCallEvent(validEvent(1, ['alice']));
    expect(reconcile).toHaveBeenLastCalledWith(
      expect.objectContaining({ participantIds: ['alice'] }),
    );
  });

  it('fetches a trailing snapshot when another malformed event arrives during recovery', async () => {
    const get = jest.mocked(applicationContainer.calls.get);
    let resolveFirst: (value: Awaited<ReturnType<typeof get>>) => void = () =>
      undefined;
    get.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
    );
    const newer = { id: 'call-a', participantIds: ['alice', 'bob'] } as Awaited<
      ReturnType<typeof get>
    >;
    get.mockResolvedValue(newer);
    const reconcile = jest.fn();
    const handlers = useWorkspaceRealtimeCallEvents({
      activeCallRef: { current: null },
      onRecoveredCalls: jest.fn(),
      receiveSignal: () => Promise.resolve(),
      reconcileCallResource: reconcile,
      sessionRef: { current: { identity: { id: 'alice' } } as Session },
    });
    handlers.handleRealtimeCallEvent(malformedEvent(1));
    handlers.handleRealtimeCallEvent(malformedEvent(2));
    expect(get).toHaveBeenCalledTimes(1);
    resolveFirst({ ...newer, participantIds: ['alice'] });
    await jest.advanceTimersByTimeAsync(1000);
    expect(get).toHaveBeenCalledTimes(2);
    expect(reconcile).toHaveBeenLastCalledWith(newer);
    await jest.advanceTimersByTimeAsync(10000);
    expect(get).toHaveBeenCalledTimes(2);
  });
});
