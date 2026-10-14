import { mock } from 'jest-mock-extended';

import type { CallStartActionsInput } from '../../../../../app/presentation/workspace/components/CallStartActionsInput';
import type { WorkspaceCallDetails } from '../../../../../app/presentation/workspace/components/resolveWorkspaceCallDetails';
import type { CallResource } from '../../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { StartCallInput } from '../../../../../contexts/calls/presentation/hooks/useCallSession';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { applicationContainer } from '../../../../../app/composition/applicationContainer';
import { useCallStartActions } from '../../../../../app/presentation/workspace/components/useCallStartActions';

jest.mock('react', () => ({
  useCallback: (callback: unknown) => callback,
  useEffect: () => undefined,
  useRef: (current: unknown) => ({ current }),
}));
jest.mock('../../../../../app/composition/applicationContainer', () => ({
  applicationContainer: {
    calls: { join: jest.fn(), startCommunityChannel: jest.fn() },
  },
}));
jest.mock('../../../../../shared/presentation/sounds', () => ({
  playAnsweredCallSound: jest.fn(),
  stopIncomingCallSound: jest.fn(),
}));

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

describe('following a superseded community voice call', () => {
  it('leaves the superseded call and rejoins the channel live call with a fresh local session', async () => {
    const session = { identity: { id: 'alice' } } as Session;
    const winner = communityCall({ id: 'call-b' });
    const microphone = { stream: {} as MediaStream };
    const steps: string[] = [];
    let resolveStarted: (input: StartCallInput) => void = () => undefined;
    const started = new Promise<StartCallInput>((resolve) => {
      resolveStarted = resolve;
    });
    // A community member is not listed on a call started by someone else, so
    // only the channel start path signs a join for the winning call.
    jest
      .mocked(applicationContainer.calls.startCommunityChannel)
      .mockImplementation(() => {
        steps.push('rejoin-channel');

        return Promise.resolve(winner);
      });
    const { followSupersededCall } = useCallStartActions(
      mock<CallStartActionsInput>({
        activeCall: null,
        activeCommunity: null,
        callDetailsForResource: () =>
          ({
            kind: 'community-voice',
            participants: [],
          }) as unknown as WorkspaceCallDetails,
        callMediaEncryptionForResource: () =>
          Promise.resolve({ mediaEncryptionEnabled: false }),
        cleanupJoinedCalls: () => Promise.resolve(),
        incomingCall: null,
        leaveCurrentCallForSwitch: () => {
          steps.push('leave');

          return Promise.resolve();
        },
        requestOptionalLocalAudio: () => Promise.resolve(microphone),
        session,
        startCall: (input: StartCallInput) => {
          resolveStarted(input);

          return Promise.resolve();
        },
      }),
    );

    followSupersededCall(
      communityCall({ status: 'ended', supersededByCallId: 'call-b' }),
    );
    const input = await started;

    expect(steps).toEqual(['leave', 'rejoin-channel']);
    expect(
      applicationContainer.calls.startCommunityChannel,
    ).toHaveBeenCalledWith(session, 'community-a', 'voice-a');
    expect(applicationContainer.calls.join).not.toHaveBeenCalled();
    expect(input).toMatchObject({
      call: winner,
      id: 'call-b',
      localStream: microphone.stream,
    });
  });
});
