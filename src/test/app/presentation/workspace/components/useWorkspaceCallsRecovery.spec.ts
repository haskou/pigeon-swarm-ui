import type { CallResource } from '../../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { CallSession } from '../../../../../contexts/calls/presentation/view-models/CallSession';
import type { CommunityResource as Community } from '../../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { applicationContainer } from '../../../../../app/composition/applicationContainer';
import { communityVoiceChannelTopologyKey } from '../../../../../app/presentation/workspace/components/communityVoicePresence';
import { useWorkspaceCallHeartbeat } from '../../../../../app/presentation/workspace/components/useWorkspaceCallHeartbeat';
import { useWorkspaceCalls } from '../../../../../app/presentation/workspace/components/useWorkspaceCalls';
import { useWorkspaceRealtimeCallEvents } from '../../../../../app/presentation/workspace/components/useWorkspaceRealtimeCallEvents';
import { useCallSession } from '../../../../../contexts/calls/presentation/hooks/useCallSession';

const mockReconcileCallResource = jest.fn();

jest.mock('react', () => ({
  useCallback: (callback: unknown) => callback,
  useEffect: () => undefined,
  useRef: (current: unknown) => ({ current }),
}));
jest.mock('../../../../../app/composition/applicationContainer', () => ({
  applicationContainer: { calls: { get: jest.fn() } },
}));
jest.mock(
  '../../../../../contexts/calls/presentation/hooks/useCallSession',
  () => ({ useCallSession: jest.fn(() => ({})) }),
);
jest.mock(
  '../../../../../contexts/calls/presentation/hooks/useCallMediaAccess',
  () => ({ useCallMediaAccess: () => ({}) }),
);
jest.mock(
  '../../../../../app/presentation/workspace/components/useCallStartActions',
  () => ({ useCallStartActions: () => ({}) }),
);
jest.mock(
  '../../../../../app/presentation/workspace/components/useWorkspaceCallHeartbeat',
  () => ({ useWorkspaceCallHeartbeat: jest.fn() }),
);
jest.mock(
  '../../../../../app/presentation/workspace/components/useCallResourceReconciliation',
  () => ({
    useCallResourceReconciliation: () => ({
      reconcileCallResource: mockReconcileCallResource,
      setIncomingCall: jest.fn(),
    }),
  }),
);
jest.mock(
  '../../../../../app/presentation/workspace/components/useWorkspaceRealtimeCallEvents',
  () => ({ useWorkspaceRealtimeCallEvents: jest.fn(() => ({})) }),
);

describe('workspace call recovery', () => {
  it('clears absent community calls after reconnect even with unchanged topology', () => {
    let communities = [
      {
        id: 'community-a',
        voiceChannels: [
          { connectedIdentityIds: ['departed'], id: 'voice-a', type: 'voice' },
        ],
      },
    ] as Community[];
    const originalTopology = communityVoiceChannelTopologyKey(communities);
    const session = { identity: { id: 'alice' } } as Session;
    useWorkspaceCalls({
      activeCommunity: null,
      communities,
      communityVoiceTopologyKey: originalTopology,
      conversations: [],
      identityNames: {},
      identityPictures: {},
      identityProfiles: {},
      onCommunitiesChange: (update) => {
        communities =
          typeof update === 'function' ? update(communities) : update;
      },
      onCommunitiesReload: () => Promise.resolve(),
      onErrorChange: jest.fn(),
      session,
      sessionRef: { current: session },
    });
    const input = jest.mocked(useWorkspaceRealtimeCallEvents).mock.calls[0][0];
    input.onRecoveredCalls([]);
    expect(communities[0].voiceChannels?.[0].connectedIdentityIds).toEqual([]);
    expect(communityVoiceChannelTopologyKey(communities)).toBe(
      originalTopology,
    );
  });
});

describe('workspace terminal heartbeat denial', () => {
  it.each([
    { activeCallId: 'call-a', expectedPresence: ['bob'], shouldEnd: true },
    {
      activeCallId: 'call-b',
      expectedPresence: ['alice', 'bob'],
      shouldEnd: false,
    },
  ])(
    'preserves only valid local presence when the active call is $activeCallId',
    ({ activeCallId, expectedPresence, shouldEnd }) => {
      jest.clearAllMocks();
      const endCall = jest.fn();
      jest.mocked(useCallSession).mockReturnValue({
        endCall,
      } as unknown as ReturnType<typeof useCallSession>);
      let communities = [
        {
          id: 'community-a',
          voiceChannels: [
            {
              connectedIdentityIds: ['alice', 'bob'],
              id: 'voice-a',
              type: 'voice',
            },
          ],
        },
      ] as Community[];
      const session = { identity: { id: 'alice' } } as Session;
      useWorkspaceCalls({
        activeCommunity: null,
        communities,
        communityVoiceTopologyKey: '',
        conversations: [],
        identityNames: {},
        identityPictures: {},
        identityProfiles: {},
        onCommunitiesChange: (update) => {
          communities =
            typeof update === 'function' ? update(communities) : update;
        },
        onCommunitiesReload: () => Promise.resolve(),
        onErrorChange: jest.fn(),
        session,
        sessionRef: { current: session },
      });
      const { activeCallRef } = jest.mocked(useWorkspaceRealtimeCallEvents).mock
        .calls[0][0];
      activeCallRef.current = { id: activeCallId } as CallSession;
      const { onAccessDenied } = jest.mocked(useWorkspaceCallHeartbeat).mock
        .calls[0][0];

      onAccessDenied('call-a');

      expect(communities[0].voiceChannels?.[0].connectedIdentityIds).toEqual(
        expectedPresence,
      );
      expect(endCall).toHaveBeenCalledTimes(shouldEnd ? 1 : 0);
    },
  );
});

describe('workspace heartbeat denial of a superseded community call', () => {
  function deniedCommunityCall(snapshot: Promise<CallResource>): {
    endCall: jest.Mock;
    settled: Promise<void>;
  } {
    jest.clearAllMocks();
    const endCall = jest.fn();
    jest.mocked(useCallSession).mockReturnValue({
      endCall,
    } as unknown as ReturnType<typeof useCallSession>);
    jest.mocked(applicationContainer.calls.get).mockReturnValue(snapshot);
    const session = { identity: { id: 'alice' } } as Session;
    useWorkspaceCalls({
      activeCommunity: null,
      communities: [],
      communityVoiceTopologyKey: '',
      conversations: [],
      identityNames: {},
      identityPictures: {},
      identityProfiles: {},
      onCommunitiesChange: jest.fn(),
      onCommunitiesReload: () => Promise.resolve(),
      onErrorChange: jest.fn(),
      session,
      sessionRef: { current: session },
    });
    const { activeCallRef } = jest.mocked(useWorkspaceRealtimeCallEvents).mock
      .calls[0][0];
    activeCallRef.current = {
      id: 'call-a',
      kind: 'community-voice',
    } as CallSession;
    const { onAccessDenied } = jest.mocked(useWorkspaceCallHeartbeat).mock
      .calls[0][0];

    onAccessDenied('call-a');

    return {
      endCall,
      settled: snapshot.then(
        () => new Promise((resolve) => setImmediate(resolve)),
        () => new Promise((resolve) => setImmediate(resolve)),
      ),
    };
  }

  it('reconciles the superseded snapshot so the client follows the winner', async () => {
    const superseded = {
      id: 'call-a',
      status: 'ended',
      supersededByCallId: 'call-b',
    } as CallResource;
    const { endCall, settled } = deniedCommunityCall(
      Promise.resolve(superseded),
    );

    await settled;

    expect(mockReconcileCallResource).toHaveBeenCalledWith(superseded);
    expect(endCall).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'ended without a winner',
      snapshot: () =>
        Promise.resolve({ id: 'call-a', status: 'ended' } as CallResource),
    },
    {
      name: 'unavailable',
      snapshot: () => Promise.reject(new Error('Call not found')),
    },
  ])(
    'ends the active call when its snapshot is $name',
    async ({ snapshot }) => {
      const { endCall, settled } = deniedCommunityCall(snapshot());

      await settled;

      expect(endCall).toHaveBeenCalledTimes(1);
      expect(mockReconcileCallResource).not.toHaveBeenCalled();
    },
  );
});
