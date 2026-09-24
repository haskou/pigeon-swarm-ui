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
  applicationContainer: { calls: { get: jest.fn() } },
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

describe('workspace malformed snapshot recovery', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

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
