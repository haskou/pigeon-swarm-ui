import { mock } from 'jest-mock-extended';

import type { CallStartActionsInput } from '../../../../../app/presentation/workspace/components/CallStartActionsInput';
import type { WorkspaceCallDetails } from '../../../../../app/presentation/workspace/components/resolveWorkspaceCallDetails';
import type { IncomingWorkspaceCall } from '../../../../../app/presentation/workspace/components/useCallResourceReconciliation';
import type { CallResource } from '../../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { StartCallInput } from '../../../../../contexts/calls/presentation/hooks/StartCallInput';
import type { CommunityResource } from '../../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { applicationContainer } from '../../../../../app/composition/applicationContainer';
import { useCallStartActions } from '../../../../../app/presentation/workspace/components/useCallStartActions';
import { CallPeerConnections } from '../../../../../contexts/calls/infrastructure/media/CallPeerConnections';
import { CallMediaEncryptionUnavailableError } from '../../../../../contexts/calls/presentation/errors/CallMediaEncryptionUnavailableError';
import { copy } from '../../../../../shared/presentation/i18n/copy';

jest.mock('react', () => ({
  useCallback: (callback: unknown) => callback,
  useEffect: () => undefined,
  useRef: (current: unknown) => ({ current }),
}));
jest.mock('../../../../../app/composition/applicationContainer', () => ({
  applicationContainer: {
    calls: {
      get: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
      startCommunityChannel: jest.fn(),
      startConversation: jest.fn(),
    },
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
        callMediaEncryptionForResource: () => Promise.resolve({}),
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

type CallStartOutcome = { error?: string; started?: StartCallInput };

const alice = { identity: { id: 'alice' } } as Session;
const aliceMicrophone = { stream: {} as MediaStream };

function directCall(aliceStatus: 'joined' | 'ringing'): CallResource {
  return {
    id: 'call-direct',
    networkId: 'network-a',
    participantIds: ['alice', 'bob'],
    participants: [
      {
        connected: aliceStatus === 'joined',
        identityId: 'alice',
        status: aliceStatus,
      },
      { connected: true, identityId: 'bob', status: 'joined' },
    ],
    scope: { conversationId: 'conversation-a', type: 'conversation' },
    status: 'active',
  } as CallResource;
}

function community(
  visibility: CommunityResource['visibility'],
): CommunityResource {
  return {
    createdAt: 1,
    description: '',
    id: 'community-a',
    memberIds: ['alice'],
    name: 'Community',
    networkId: 'network-a',
    ownerIdentityId: 'alice',
    textChannels: [],
    visibility,
  };
}

/** Settles with the error shown to the user or the local session started. */
function callStartHarness(overrides: Partial<CallStartActionsInput>): {
  input: CallStartActionsInput;
  outcome: Promise<CallStartOutcome>;
} {
  let settle: (outcome: CallStartOutcome) => void = () => undefined;
  const outcome = new Promise<CallStartOutcome>((resolve) => {
    settle = resolve;
  });
  const input = mock<CallStartActionsInput>({
    activeCall: null,
    activeCommunity: null,
    callDetailsForResource: () =>
      ({
        kind: 'one-to-one',
        participants: [],
        title: 'Bob',
      }) as WorkspaceCallDetails,
    callMediaEncryptionForResource: () =>
      Promise.resolve({
        mediaEncryptionKey: 'call-key',
      }),
    cleanupJoinedCalls: () => Promise.resolve(),
    incomingCall: null,
    leaveCurrentCallForSwitch: () => Promise.resolve(),
    requestOptionalLocalAudio: jest.fn(() => Promise.resolve(aliceMicrophone)),
    session: alice,
    setIncomingCall: jest.fn(),
    setSendError: jest.fn((error) => {
      if (typeof error === 'string') settle({ error });
    }),
    startCall: jest.fn((started: StartCallInput) => {
      settle({ started });

      return Promise.resolve();
    }),
    stopLocalAudio: jest.fn(),
    ...overrides,
  });

  return { input, outcome };
}

describe('refusing private calls this device cannot encrypt', () => {
  const voiceChannel = { id: 'voice-a', name: 'Voice' };

  beforeEach(() => {
    jest
      .spyOn(CallPeerConnections, 'mediaEncryptionSupported')
      .mockReturnValue(false);
    jest
      .mocked(applicationContainer.calls.startConversation)
      .mockResolvedValue(directCall('joined'));
    jest
      .mocked(applicationContainer.calls.startCommunityChannel)
      .mockResolvedValue(communityCall({}));
    jest
      .mocked(applicationContainer.calls.get)
      .mockResolvedValue(directCall('ringing'));
    jest
      .mocked(applicationContainer.calls.join)
      .mockResolvedValue(directCall('joined'));
    jest.mocked(applicationContainer.calls.leave).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not start a direct call in a browser that cannot encrypt media', async () => {
    const { input, outcome } = callStartHarness({});

    useCallStartActions(input).startConversationCall({
      conversationId: 'conversation-a',
      kind: 'one-to-one',
      participants: [],
      title: 'Bob',
    });

    await expect(outcome).resolves.toEqual({
      error: copy.calls.mediaEncryptionUnsupported,
    });
    expect(input.requestOptionalLocalAudio).not.toHaveBeenCalled();
    expect(applicationContainer.calls.startConversation).not.toHaveBeenCalled();
  });

  it('does not join a private community voice channel in a browser that cannot encrypt media', async () => {
    const { input, outcome } = callStartHarness({
      activeCommunity: community('private'),
    });

    useCallStartActions(input).startCommunityVoiceCall(voiceChannel);

    await expect(outcome).resolves.toEqual({
      error: copy.calls.mediaEncryptionUnsupported,
    });
    expect(input.requestOptionalLocalAudio).not.toHaveBeenCalled();
    expect(
      applicationContainer.calls.startCommunityChannel,
    ).not.toHaveBeenCalled();
  });

  it('joins a public community voice channel, which never uses media E2EE', async () => {
    const { input, outcome } = callStartHarness({
      activeCommunity: community('public'),
      callMediaEncryptionForResource: () =>
        Promise.resolve({
          mediaEncryptionUnavailableReason: 'public-community',
        }),
    });

    useCallStartActions(input).startCommunityVoiceCall(voiceChannel);

    await expect(outcome).resolves.toMatchObject({
      started: {
        id: 'call-a',
        mediaEncryptionUnavailableReason: 'public-community',
      },
    });
  });

  it('declines an incoming direct call in a browser that cannot encrypt media', async () => {
    const { input, outcome } = callStartHarness({
      incomingCall: {
        call: directCall('ringing'),
        participants: [],
        title: 'Bob',
      } as IncomingWorkspaceCall,
    });

    useCallStartActions(input).acceptIncomingCall();

    await expect(outcome).resolves.toEqual({
      error: copy.calls.mediaEncryptionUnsupported,
    });
    expect(applicationContainer.calls.join).not.toHaveBeenCalled();
    expect(applicationContainer.calls.leave).toHaveBeenCalledWith(
      alice,
      'call-direct',
    );
    expect(input.setIncomingCall).toHaveBeenCalledWith(null);
    expect(input.requestOptionalLocalAudio).not.toHaveBeenCalled();
  });

  it('leaves a private community call it has no key for instead of joining it unencrypted', async () => {
    jest
      .spyOn(CallPeerConnections, 'mediaEncryptionSupported')
      .mockReturnValue(true);
    const { input, outcome } = callStartHarness({
      activeCommunity: community('private'),
      callMediaEncryptionForResource: () =>
        Promise.reject(new CallMediaEncryptionUnavailableError('missing-key')),
    });

    useCallStartActions(input).startCommunityVoiceCall(voiceChannel);

    await expect(outcome).resolves.toEqual({
      error: copy.calls.mediaEncryptionMissingKey,
    });
    expect(applicationContainer.calls.leave).toHaveBeenCalledWith(
      alice,
      'call-a',
    );
    expect(input.stopLocalAudio).toHaveBeenCalledWith(aliceMicrophone.stream);
  });

  it('leaves a direct call it has no key for instead of connecting it unencrypted', async () => {
    jest
      .spyOn(CallPeerConnections, 'mediaEncryptionSupported')
      .mockReturnValue(true);
    const { input, outcome } = callStartHarness({
      callMediaEncryptionForResource: () =>
        Promise.reject(new CallMediaEncryptionUnavailableError('missing-key')),
    });

    useCallStartActions(input).startConversationCall({
      conversationId: 'conversation-a',
      kind: 'one-to-one',
      participants: [],
      title: 'Bob',
    });

    await expect(outcome).resolves.toEqual({
      error: copy.calls.mediaEncryptionMissingKey,
    });
    expect(applicationContainer.calls.leave).toHaveBeenCalledWith(
      alice,
      'call-direct',
    );
    expect(input.stopLocalAudio).toHaveBeenCalledWith(aliceMicrophone.stream);
  });
});
