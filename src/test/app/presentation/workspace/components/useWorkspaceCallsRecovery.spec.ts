import type { CallSession } from '../../../../../contexts/calls/presentation/view-models/CallSession';
import type {
  Community,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

import { communityVoiceChannelTopologyKey } from '../../../../../app/presentation/workspace/components/communityVoicePresence';
import { useWorkspaceCallHeartbeat } from '../../../../../app/presentation/workspace/components/useWorkspaceCallHeartbeat';
import { useWorkspaceCalls } from '../../../../../app/presentation/workspace/components/useWorkspaceCalls';
import { useWorkspaceRealtimeCallEvents } from '../../../../../app/presentation/workspace/components/useWorkspaceRealtimeCallEvents';
import { useCallSession } from '../../../../../contexts/calls/presentation/hooks/useCallSession';

jest.mock('react', () => ({
  useCallback: (callback: unknown) => callback,
  useEffect: () => undefined,
  useRef: (current: unknown) => ({ current }),
}));
jest.mock('../../../../../app/composition/applicationContainer', () => ({
  applicationContainer: { calls: {} },
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
    useCallResourceReconciliation: () => ({ setIncomingCall: jest.fn() }),
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
