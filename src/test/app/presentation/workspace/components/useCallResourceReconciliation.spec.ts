import type { WorkspaceCallDetails } from '../../../../../app/presentation/workspace/components/resolveWorkspaceCallDetails';
import type { CallResource } from '../../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { CallSession } from '../../../../../contexts/calls/presentation/view-models/CallSession';

import { useCallResourceReconciliation } from '../../../../../app/presentation/workspace/components/useCallResourceReconciliation';

const mockHooks = {
  effects: [] as (() => void)[],
  refIndex: 0,
  refs: [] as { current: unknown }[],
};

jest.mock('react', () => ({
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void) => {
    mockHooks.effects.push(effect);
  },
  useRef: (current: unknown) => {
    const index = mockHooks.refIndex++;
    mockHooks.refs[index] ??= { current };

    return mockHooks.refs[index];
  },
  useState: (current: unknown) => [current, jest.fn()],
}));
jest.mock('../../../../../shared/presentation/sounds', () => ({
  playEndedCallSound: jest.fn(),
  playIncomingCallSound: jest.fn(),
  stopIncomingCallSound: jest.fn(),
}));
jest.mock(
  '../../../../../contexts/notifications/presentation/services/pwaNotifications',
  () => ({ showPwaNotification: jest.fn() }),
);

function communityCall(overrides: Partial<CallResource>): CallResource {
  return {
    id: 'call-a',
    networkId: 'network-a',
    participantIds: ['alice'],
    participants: [{ connected: true, identityId: 'alice', status: 'joined' }],
    scope: {
      channelId: 'voice-a',
      communityId: 'community-a',
      type: 'community_channel',
    },
    status: 'active',
    ...overrides,
  } as CallResource;
}

function reconcileActiveCommunityCall(call: CallResource): {
  endCall: jest.Mock;
  followSupersededCall: jest.Mock;
} {
  const endCall = jest.fn();
  const followSupersededCall = jest.fn();
  const { reconcileCallResource } = useCallResourceReconciliation({
    activeCall: { id: 'call-a', kind: 'community-voice' } as CallSession,
    callDetailsForResource: () =>
      ({ kind: 'community-voice' }) as WorkspaceCallDetails,
    currentIdentityId: 'alice',
    endCall,
    followSupersededCall,
    reconcileCall: jest.fn(),
    setCommunities: jest.fn(),
  });

  reconcileCallResource(call);

  return { endCall, followSupersededCall };
}

describe('call resource reconciliation of a superseded community call', () => {
  it('follows the winning call instead of ending the active voice call', () => {
    const superseded = communityCall({
      endedAt: 200,
      status: 'ended',
      supersededByCallId: 'call-b',
    });

    const { endCall, followSupersededCall } =
      reconcileActiveCommunityCall(superseded);

    expect(followSupersededCall).toHaveBeenCalledWith(superseded);
    expect(endCall).not.toHaveBeenCalled();
  });

  it('still ends the active voice call when its call ended without a winner', () => {
    const { endCall, followSupersededCall } = reconcileActiveCommunityCall(
      communityCall({ endedAt: 200, status: 'ended' }),
    );

    expect(endCall).toHaveBeenCalledTimes(1);
    expect(followSupersededCall).not.toHaveBeenCalled();
  });
});

describe('call resource reconciliation while a call session is starting', () => {
  const alice = { connected: true, identityId: 'alice', status: 'joined' };
  const bob = { connected: true, identityId: 'bob', status: 'joined' };
  const joinResponse = communityCall({});
  const rosterWithBob = communityCall({
    participantIds: ['alice', 'bob'],
    participants: [alice, bob],
  } as Partial<CallResource>);

  function render(
    activeCall: CallSession | null,
    reconcileCall: jest.Mock,
  ): (call: CallResource) => void {
    mockHooks.refIndex = 0;
    mockHooks.effects = [];
    const { reconcileCallResource } = useCallResourceReconciliation({
      activeCall,
      callDetailsForResource: () =>
        ({ kind: 'community-voice' }) as WorkspaceCallDetails,
      currentIdentityId: 'alice',
      endCall: jest.fn(),
      followSupersededCall: jest.fn(),
      reconcileCall,
      setCommunities: jest.fn(),
    });
    mockHooks.effects.forEach((effect) => effect());

    return reconcileCallResource;
  }

  function startedSession(call: CallResource): CallSession {
    return { call, id: call.id, kind: 'community-voice' } as CallSession;
  }

  beforeEach(() => {
    mockHooks.refs = [];
  });

  it('reconciles the new session with a roster received before it became active', () => {
    const reconcileCall = jest.fn();

    render(null, reconcileCall)(rosterWithBob);
    expect(reconcileCall).not.toHaveBeenCalled();
    render(startedSession(joinResponse), reconcileCall);

    expect(reconcileCall).toHaveBeenLastCalledWith(
      rosterWithBob,
      expect.anything(),
    );
  });

  it('keeps the join response when the remembered roster no longer has the current identity joined', () => {
    const reconcileCall = jest.fn();
    const reconcileCallResource = render(null, reconcileCall);

    reconcileCallResource(rosterWithBob);
    reconcileCallResource(
      communityCall({
        participantIds: ['alice', 'bob'],
        participants: [{ ...alice, connected: false, status: 'left' }, bob],
      } as Partial<CallResource>),
    );
    render(startedSession(joinResponse), reconcileCall);

    expect(reconcileCall).toHaveBeenLastCalledWith(
      joinResponse,
      expect.anything(),
    );
  });
});
