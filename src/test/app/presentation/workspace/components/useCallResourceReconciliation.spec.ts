import type { WorkspaceCallDetails } from '../../../../../app/presentation/workspace/components/resolveWorkspaceCallDetails';
import type { CallResource } from '../../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { CallSession } from '../../../../../contexts/calls/presentation/view-models/CallSession';

import { useCallResourceReconciliation } from '../../../../../app/presentation/workspace/components/useCallResourceReconciliation';

jest.mock('react', () => ({
  useCallback: (callback: unknown) => callback,
  useEffect: () => undefined,
  useRef: (current: unknown) => ({ current }),
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
