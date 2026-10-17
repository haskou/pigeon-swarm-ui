import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { mock, type MockProxy } from 'jest-mock-extended';

import type { CallMediaKey } from '../../../../../contexts/calls/infrastructure/media/CallMediaKey';
import type { CallMediaTransformOptions } from '../../../../../contexts/calls/infrastructure/media/CallMediaTransformOptions';
import type { SignalSender } from '../../../../../contexts/calls/infrastructure/media/descriptionPayload';
import type { FakePeerConnection } from '../../../../../contexts/calls/infrastructure/media/FakePeerConnection';
import type { FakeSender } from '../../../../../contexts/calls/infrastructure/media/FakeSender';

import {
  readCallDiagnostics,
  startCallDiagnostics,
  stopCallDiagnostics,
} from '../../../../../contexts/calls/infrastructure/media/callDebugLogger';
import { CallPeerConnections } from '../../../../../contexts/calls/infrastructure/media/CallPeerConnections';
import { RemoteCallAudio } from '../../../../../contexts/calls/infrastructure/media/RemoteCallAudio';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';
import { QueuedCallSide } from './QueuedCallSide';

const originalMediaStream = Object.getOwnPropertyDescriptor(
  globalThis,
  'MediaStream',
);
const originalPeerConnection = Object.getOwnPropertyDescriptor(
  globalThis,
  'RTCPeerConnection',
);
const originalSessionDescription = Object.getOwnPropertyDescriptor(
  globalThis,
  'RTCSessionDescription',
);
const originalRtpReceiver = Object.getOwnPropertyDescriptor(
  globalThis,
  'RTCRtpReceiver',
);
const originalRtpSender = Object.getOwnPropertyDescriptor(
  globalThis,
  'RTCRtpSender',
);
const originalIceCandidate = Object.getOwnPropertyDescriptor(
  globalThis,
  'RTCIceCandidate',
);
const originalScriptTransform = Object.getOwnPropertyDescriptor(
  globalThis,
  'RTCRtpScriptTransform',
);
const originalWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

type RtcConfigurationWithEncodedInsertableStreams = RTCConfiguration & {
  encodedInsertableStreams?: boolean;
};

function mediaStreamWithTracks(
  tracks: MediaStreamTrack[],
  id = 'media-stream-id',
): MediaStream {
  const streamTracks = [...tracks];

  return {
    addTrack: jest.fn((track: MediaStreamTrack) => {
      streamTracks.push(track);
    }),
    getAudioTracks: () =>
      streamTracks.filter((track) => track.kind === 'audio'),
    getTracks: () => streamTracks,
    getVideoTracks: () =>
      streamTracks.filter((track) => track.kind === 'video'),
    id,
    removeTrack: jest.fn((track: MediaStreamTrack) => {
      const trackIndex = streamTracks.indexOf(track);

      if (trackIndex >= 0) streamTracks.splice(trackIndex, 1);
    }),
  } as unknown as MediaStream;
}

function mediaTrack(
  id: string,
  kind: MediaStreamTrack['kind'],
  contentHint = '',
): MediaStreamTrack {
  return {
    addEventListener: jest.fn(),
    contentHint,
    enabled: true,
    id,
    kind,
    label: id,
    muted: false,
    readyState: 'live',
    removeEventListener: jest.fn(),
    stop: jest.fn(),
  } as unknown as MediaStreamTrack;
}

function remoteAudioElement(): HTMLAudioElement {
  return {
    dataset: {},
    pause: jest.fn(),
    play: jest.fn(() => Promise.resolve()),
    remove: jest.fn(),
    srcObject: null,
    volume: 1,
  } as unknown as HTMLAudioElement;
}

function callPeerConnectionManager(): CallPeerConnections {
  return new CallPeerConnections(
    new RemoteCallAudio({
      create: remoteAudioElement,
      mount: jest.fn(),
    }),
  );
}

function remoteTrackEvent(
  track: MediaStreamTrack,
  streams: MediaStream[],
): RTCTrackEvent {
  return {
    streams,
    track,
  } as unknown as RTCTrackEvent;
}

function encodedFrameStreams(): {
  readable: ReadableStream<RTCEncodedAudioFrame | RTCEncodedVideoFrame>;
  writable: WritableStream<RTCEncodedAudioFrame | RTCEncodedVideoFrame>;
} {
  return {
    readable: new ReadableStream({
      start(controller): void {
        controller.close();
      },
    }),
    writable: new WritableStream(),
  };
}

function createFakeSender(track: MediaStreamTrack | null): FakeSender {
  let currentTrack: MediaStreamTrack | null = track;

  return {
    createEncodedStreams: jest.fn(() => encodedFrameStreams()),
    replaceTrack: jest.fn((nextTrack: MediaStreamTrack | null) => {
      currentTrack = nextTrack;

      return Promise.resolve();
    }),
    get track(): MediaStreamTrack | null {
      return currentTrack;
    },
  };
}

function createFakeReceiver(kind: string): RTCRtpReceiver {
  return {
    createEncodedStreams: jest.fn(() => encodedFrameStreams()),
    track: mediaTrack(`remote-${kind}-track`, kind),
  } as unknown as RTCRtpReceiver;
}

/**
 * The senders and receivers of `peer` with no frame transform. Chromium hands
 * the frames of one still without a transform once the task that created it
 * ends to the network or the decoder untouched, even if one is set later.
 */
function untransformed(
  peer: FakePeerConnection,
): (RTCRtpReceiver | RTCRtpSender)[] {
  return [...peer.getSenders(), ...peer.getReceivers()].filter(
    ({ transform }) => !transform,
  );
}

function installEncodedStreamSupport(): void {
  function FakeRtpSender(): void {}
  function FakeRtpReceiver(): void {}

  Object.defineProperty(FakeRtpSender.prototype, 'createEncodedStreams', {
    configurable: true,
    value: jest.fn(),
  });
  Object.defineProperty(FakeRtpReceiver.prototype, 'createEncodedStreams', {
    configurable: true,
    value: jest.fn(),
  });
  Object.defineProperty(globalThis, 'RTCRtpSender', {
    configurable: true,
    value: FakeRtpSender,
  });
  Object.defineProperty(globalThis, 'RTCRtpReceiver', {
    configurable: true,
    value: FakeRtpReceiver,
  });
}

/**
 * Lets the senders and receivers `installEncodedStreamSupport` faked take an
 * RTCRtpScriptTransform too, as Chromium 141+ does; Firefox and Safari only
 * have this one. Returns the transforms the browser was asked for.
 */
function installScriptTransformSupport(): jest.Mock<
  CallMediaTransformOptions,
  [Worker, CallMediaTransformOptions]
> {
  const scriptTransform = jest.fn(
    (_worker: Worker, options: CallMediaTransformOptions) => ({ ...options }),
  );

  for (const owner of [RTCRtpSender, RTCRtpReceiver]) {
    Object.defineProperty(owner.prototype, 'transform', {
      configurable: true,
      value: null,
      writable: true,
    });
  }
  Object.defineProperty(globalThis, 'RTCRtpScriptTransform', {
    configurable: true,
    value: scriptTransform,
  });
  Object.defineProperty(globalThis, 'Worker', {
    configurable: true,
    value: jest.fn(() => mock<Worker>()),
  });

  return scriptTransform;
}

/** The worker the last RTCRtpScriptTransform cipher started. */
function lastCipherWorker(): MockProxy<Worker> {
  const { results } = (Worker as unknown as jest.Mock<MockProxy<Worker>>).mock;

  return results[results.length - 1].value as MockProxy<Worker>;
}

let fakeConnectionCount = 0;

/**
 * Chromium and WebKit never run the frame transforms of a connection again,
 * on the senders and receivers it already has, once it rolled a local offer
 * back (#560): assigning them anew changes nothing. Firefox keeps them. The
 * fake takes the first two's side so a rolled back connection is as silent as
 * theirs.
 */
function detachFrameTransforms(peer: FakePeerConnection): void {
  for (const endpoint of [...peer.senders, ...peer.receivers]) {
    Object.defineProperty(endpoint, 'transform', {
      configurable: true,
      get: () => null,
      set: () => undefined,
    });
  }
}

function fingerprintOf(
  description: RTCSessionDescriptionInit | null,
): string | undefined {
  return description?.sdp?.match(/^a=fingerprint:([^\r\n]+)$/m)?.[1];
}

/** A description of the connection whose DTLS certificate is `fingerprint`. */
function describedBy(
  type: RTCSdpType,
  fingerprint: string,
  revision = 1,
): { sdp: string; type: RTCSdpType } {
  return {
    sdp: `v=0\r\na=ice-ufrag:${fingerprint}-${revision}\r\na=fingerprint:${fingerprint}\r\n`,
    type,
  };
}

function createFakePeerConnection(): FakePeerConnection {
  const senders: RTCRtpSender[] = [];
  const receivers: RTCRtpReceiver[] = [];
  let offerCount = 0;
  let answerCount = 0;

  fakeConnectionCount += 1;
  const fingerprint = `sha-256 FA:CE:${fakeConnectionCount.toString(16).padStart(2, '0').toUpperCase()}`;
  const peer: FakePeerConnection = {
    addEventListener: jest.fn(),
    addIceCandidate: jest.fn(() => Promise.resolve()),
    addTrack: jest.fn((track: MediaStreamTrack) => {
      const sender = createFakeSender(track) as unknown as RTCRtpSender;

      senders.push(sender);
      receivers.push(createFakeReceiver(track.kind));

      return sender;
    }),
    addTransceiver: jest.fn((kind: string) => {
      const transceiver = {
        receiver: createFakeReceiver(kind),
        sender: createFakeSender(null) as unknown as RTCRtpSender,
      };

      senders.push(transceiver.sender);
      receivers.push(transceiver.receiver);

      return transceiver as RTCRtpTransceiver;
    }),
    close: jest.fn(),
    connectionState: 'new',
    createAnswer: jest.fn(() => {
      answerCount += 1;

      return Promise.resolve(describedBy('answer', fingerprint, answerCount));
    }),
    createOffer: jest.fn(() => {
      offerCount += 1;

      return Promise.resolve(describedBy('offer', fingerprint, offerCount));
    }),
    getConfiguration: jest.fn(() => ({ iceTransportPolicy: 'relay' })),
    getReceivers: jest.fn(() => receivers),
    getSenders: jest.fn(() => senders),
    iceConnectionState: 'new',
    localDescription: null,
    receivers,
    remoteDescription: null,
    removeTrack: jest.fn((sender: RTCRtpSender) => {
      const senderIndex = senders.indexOf(sender);

      if (senderIndex >= 0) senders.splice(senderIndex, 1);
    }),
    restartIce: jest.fn(),
    senders,
    setConfiguration: jest.fn(),
    setLocalDescription: jest.fn((description?: RTCSessionDescriptionInit) => {
      if (!description) return Promise.resolve();

      if (description.type === 'rollback') {
        peer.localDescription = null;
        peer.signalingState = 'stable';
        detachFrameTransforms(peer);

        return Promise.resolve();
      }

      peer.localDescription = description;
      peer.signalingState =
        description.type === 'offer' ? 'have-local-offer' : 'stable';

      return Promise.resolve();
    }),
    setRemoteDescription: jest.fn((description: RTCSessionDescriptionInit) => {
      if (
        description.type === 'offer' &&
        peer.signalingState === 'have-local-offer'
      ) {
        // A remote offer takes the place of a pending local one: an
        // implicit rollback.
        peer.localDescription = null;
        detachFrameTransforms(peer);
      }

      peer.remoteDescription = description;
      peer.signalingState =
        description.type === 'offer' ? 'have-remote-offer' : 'stable';

      return Promise.resolve();
    }),
    signalingState: 'stable',
  };

  return peer;
}

function registeredPeerEventListener(
  peer: FakePeerConnection,
  eventName: string,
): EventListener {
  const calls = (peer.addEventListener as jest.Mock).mock.calls as [
    string,
    EventListener,
  ][];
  const listener = calls.find(
    ([registeredEventName]) => registeredEventName === eventName,
  )?.[1];

  if (!listener) throw new Error(`Missing ${eventName} listener.`);

  return listener;
}

/**
 * What the browser does when a remote description brings a media section no
 * transceiver has yet: it creates one, then reports the new signaling state.
 */
function createRemoteTransceiver(peer: FakePeerConnection, kind: string): void {
  peer.senders.push(createFakeSender(null) as unknown as RTCRtpSender);
  peer.receivers.push(createFakeReceiver(kind));
  // eslint-disable-next-line no-param-reassign -- the browser moves its state
  peer.signalingState = 'have-remote-offer';
  registeredPeerEventListener(
    peer,
    'signalingstatechange',
  )(new Event('signalingstatechange'));
}

function installMediaStreamMock(): void {
  Object.defineProperty(globalThis, 'MediaStream', {
    configurable: true,
    value: jest.fn((tracks: MediaStreamTrack[] = []) =>
      mediaStreamWithTracks(tracks),
    ),
  });
}

function installPeerConnectionMock(
  peers: FakePeerConnection[],
  configurations: RTCConfiguration[] = [],
): void {
  Object.defineProperty(globalThis, 'RTCPeerConnection', {
    configurable: true,
    value: jest.fn((configuration: RTCConfiguration) => {
      const peer = createFakePeerConnection();

      configurations.push(configuration);
      peers.push(peer);

      return peer;
    }),
  });
}

function installSessionDescriptionMock(): void {
  Object.defineProperty(globalThis, 'RTCSessionDescription', {
    configurable: true,
    value: jest.fn((description: RTCSessionDescriptionInit) => description),
  });
}

function restoreGlobalProperty(
  property:
    | 'RTCIceCandidate'
    | 'MediaStream'
    | 'RTCPeerConnection'
    | 'RTCSessionDescription'
    | 'RTCRtpReceiver'
    | 'RTCRtpScriptTransform'
    | 'RTCRtpSender'
    | 'Worker'
    | 'window',
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) {
    Object.defineProperty(globalThis, property, descriptor);

    return;
  }

  Reflect.deleteProperty(globalThis, property);
}

/**
 * Makes each local sender of the next peer connections emit `frame` once and
 * collect what it hands to the network in `written`.
 */
function installOutboundFrame(frame: Uint8Array, written: ArrayBuffer[]): void {
  const createPeer = globalThis.RTCPeerConnection as unknown as jest.Mock<
    FakePeerConnection,
    [RTCConfiguration]
  >;
  const create = createPeer.getMockImplementation();

  createPeer.mockImplementation((configuration) => {
    const peer = (create as (value: RTCConfiguration) => FakePeerConnection)(
      configuration,
    );
    const addTrack = peer.addTrack as (track: MediaStreamTrack) => RTCRtpSender;

    peer.addTrack = jest.fn((track: MediaStreamTrack) => {
      const sender = addTrack(track) as unknown as FakeSender;

      sender.createEncodedStreams = jest.fn(() => ({
        readable: new ReadableStream<
          RTCEncodedAudioFrame | RTCEncodedVideoFrame
        >({
          start(controller): void {
            controller.enqueue({
              data: frame.slice().buffer,
            } as RTCEncodedAudioFrame);
            controller.close();
          },
        }),
        writable: new WritableStream<
          RTCEncodedAudioFrame | RTCEncodedVideoFrame
        >({
          write(encoded): void {
            written.push(encoded.data);
          },
        }),
      }));

      return sender as unknown as RTCRtpSender;
    });

    return peer;
  });
}

async function framesWritten(written: ArrayBuffer[]): Promise<void> {
  for (let turn = 0; turn < 100 && written.length === 0; turn += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

const encryptedMedia = { acceptsEncrypted: true, enabled: true, version: 2 };
const ownCall = { callId: 'call-id', senderId: 'current-identity-id' };

function callKey(epoch = 0): CallMediaKey {
  return { epoch, key: SymmetricKey.generate().valueOf() };
}

/** An identity of a private call whose signals queue until delivered. */
function encryptedCallSide(identityId: string): QueuedCallSide {
  const manager = callPeerConnectionManager();

  manager.configure(() =>
    Promise.resolve({
      iceServers: [{ urls: `turn:${identityId}.example.test` }],
    }),
  );
  manager.configureMediaEncryption(
    { callId: 'call-id', senderId: identityId },
    callKey(),
  );
  manager.setLocalStream(
    mediaStreamWithTracks([mediaTrack(`${identityId}-microphone`, 'audio')]),
  );

  return new QueuedCallSide(identityId, manager);
}

/** The connections `side` created, oldest first. */
function connectionsOf(
  side: QueuedCallSide,
  peers: FakePeerConnection[],
  configurations: RTCConfiguration[],
): FakePeerConnection[] {
  return peers.filter(
    (_peer, index) =>
      configurations[index].iceServers?.[0]?.urls ===
      `turn:${side.identityId}.example.test`,
  );
}

/**
 * Delivers both outboxes, `first`'s before `second`'s, until neither side has
 * anything left to say.
 */
async function converse(
  first: QueuedCallSide,
  second: QueuedCallSide,
): Promise<void> {
  for (let turn = 0; turn < 10; turn += 1) {
    // Let the negotiations the last signals started run to their end.
    await new Promise((resolve) => setTimeout(resolve, 0));

    if (first.outbox.length === 0 && second.outbox.length === 0) return;

    await first.deliverTo(second);
    await second.deliverTo(first);
  }
}

describe(CallPeerConnections.name, () => {
  afterEach(() => {
    jest.useRealTimers();
    restoreGlobalProperty('RTCIceCandidate', originalIceCandidate);
    restoreGlobalProperty('MediaStream', originalMediaStream);
    restoreGlobalProperty('RTCPeerConnection', originalPeerConnection);
    restoreGlobalProperty('RTCSessionDescription', originalSessionDescription);
    restoreGlobalProperty('RTCRtpReceiver', originalRtpReceiver);
    restoreGlobalProperty('RTCRtpSender', originalRtpSender);
    restoreGlobalProperty('RTCRtpScriptTransform', originalScriptTransform);
    restoreGlobalProperty('Worker', originalWorker);
    restoreGlobalProperty('window', originalWindow);
  });

  it('retries an offer rejected before the peer join has replicated', async () => {
    jest.useFakeTimers();
    const peers: FakePeerConnection[] = [];

    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const sendSignal = jest
      .fn<ReturnType<SignalSender>, Parameters<SignalSender>>()
      .mockRejectedValueOnce(
        new HttpJsonError(
          409,
          'Conflict',
          '{"code":"CallParticipantNotFoundError"}',
        ),
      )
      .mockResolvedValue(undefined);

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    const sending = manager.ensurePeer('remote', true, sendSignal);
    const result = expect(sending).resolves.toBeUndefined();

    await jest.advanceTimersByTimeAsync(5000);
    await result;
    expect(sendSignal).toHaveBeenCalledTimes(2);
    expect(sendSignal.mock.calls[1]).toEqual(sendSignal.mock.calls[0]);
    expect(peers[0].createOffer).toHaveBeenCalledTimes(1);
    manager.reset();
  });

  it('announces encrypted media again when retrying a rejected offer', async () => {
    jest.useFakeTimers();
    const peers: FakePeerConnection[] = [];

    installEncodedStreamSupport();
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const sendSignal = jest
      .fn<ReturnType<SignalSender>, Parameters<SignalSender>>()
      .mockRejectedValueOnce(
        new HttpJsonError(
          409,
          'Conflict',
          '{"code":"CallParticipantNotFoundError"}',
        ),
      )
      .mockResolvedValue(undefined);

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.configureMediaEncryption(ownCall, callKey());
    const sending = manager.ensurePeer('remote', true, sendSignal);

    await jest.advanceTimersByTimeAsync(500);
    await sending;
    expect(
      sendSignal.mock.calls.map((call) => call[2].mediaEncryption),
    ).toEqual([encryptedMedia, encryptedMedia]);
    manager.reset();
  });

  it('delivers a pending answer before renegotiating', async () => {
    jest.useFakeTimers();
    const peers: FakePeerConnection[] = [];

    installSessionDescriptionMock();
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const sendSignal = jest
      .fn<ReturnType<SignalSender>, Parameters<SignalSender>>()
      .mockRejectedValueOnce(
        new HttpJsonError(
          409,
          'Conflict',
          '{"code":"CallParticipantNotFoundError"}',
        ),
      )
      .mockResolvedValue(undefined);

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    await manager.ensurePeer('remote', false, sendSignal);
    const answering = manager.handleSignal(
      'remote',
      'offer',
      { sdp: 'offer', type: 'offer' },
      sendSignal,
      'local',
    );

    await jest.advanceTimersByTimeAsync(0);
    expect(sendSignal.mock.calls.map((call) => call[1])).toEqual(['answer']);
    registeredPeerEventListener(
      peers[0],
      'negotiationneeded',
    )(new Event('negotiationneeded'));
    await jest.advanceTimersByTimeAsync(0);
    expect(peers[0].createOffer).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(500);
    await answering;
    expect(sendSignal.mock.calls.map((call) => call[1])).toEqual([
      'answer',
      'answer',
      'offer',
    ]);
    manager.reset();
  });

  it('includes gathered candidates when retrying a rejected offer', async () => {
    jest.useFakeTimers();
    const peers: FakePeerConnection[] = [];

    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const sendSignal = jest
      .fn<ReturnType<SignalSender>, Parameters<SignalSender>>()
      .mockRejectedValueOnce(
        new HttpJsonError(
          409,
          'Conflict',
          '{"code":"CallParticipantNotFoundError"}',
        ),
      )
      .mockResolvedValue(undefined);

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    const sending = manager.ensurePeer('remote', true, sendSignal);

    await jest.advanceTimersByTimeAsync(0);
    const sdp = peers[0].localDescription!.sdp + '\r\na=candidate:gathered';
    await peers[0].setLocalDescription({ sdp, type: 'offer' });
    await jest.advanceTimersByTimeAsync(500);
    await sending;
    expect(sendSignal.mock.calls[1][2].sdp).toBe(sdp);
    manager.reset();
  });

  it('does not resend an offer after the peer is reset', async () => {
    jest.useFakeTimers();
    const peers: FakePeerConnection[] = [];

    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const sendSignal = jest
      .fn<ReturnType<SignalSender>, Parameters<SignalSender>>()
      .mockRejectedValue(
        new HttpJsonError(
          409,
          'Conflict',
          '{"code":"CallParticipantNotFoundError"}',
        ),
      );

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    const sending = manager.ensurePeer('remote', true, sendSignal);

    await jest.advanceTimersByTimeAsync(0);
    expect(sendSignal).toHaveBeenCalledTimes(1);
    manager.reset();
    await jest.advanceTimersByTimeAsync(5000);
    await sending;
    expect(sendSignal).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])(
    'retries a rejected candidate unless ICE restarts (restart=%s)',
    async (restart) => {
      jest.useFakeTimers();
      const peers: FakePeerConnection[] = [];

      installPeerConnectionMock(peers);
      const manager = callPeerConnectionManager();
      const sendSignal = jest
        .fn<ReturnType<SignalSender>, Parameters<SignalSender>>()
        .mockResolvedValue(undefined);

      manager.configure(() => Promise.resolve({ iceServers: [] }));
      await manager.ensurePeer('remote', true, sendSignal);
      const peer = peers[0];
      await peer.setLocalDescription({
        sdp: 'v=0\r\na=ice-ufrag:original\r\n',
        type: 'offer',
      });
      sendSignal.mockClear();
      sendSignal.mockRejectedValueOnce(
        new HttpJsonError(
          409,
          'Conflict',
          '{"code":"CallParticipantNotFoundError"}',
        ),
      );
      const candidate = {
        candidate: 'candidate:relay',
        sdpMid: '0',
        usernameFragment: 'original',
      };
      const event = Object.assign(new Event('icecandidate'), {
        candidate: { toJSON: () => candidate },
      });
      registeredPeerEventListener(peer, 'icecandidate')(event);
      await jest.advanceTimersByTimeAsync(0);

      if (restart)
        await peer.setLocalDescription({
          sdp: 'v=0\r\na=ice-ufrag:replacement\r\n',
          type: 'offer',
        });
      await jest.advanceTimersByTimeAsync(500);

      expect(sendSignal).toHaveBeenCalledTimes(restart ? 1 : 2);

      if (!restart)
        expect(sendSignal.mock.calls[1]).toEqual([
          'remote',
          'ice_candidate',
          candidate,
        ]);
      manager.reset();
    },
  );

  it('replaces recaptured microphone tracks without removing the sender', async () => {
    const peers: FakePeerConnection[] = [];

    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const initialMicrophone = mediaTrack('microphone-1', 'audio');
    const nextMicrophone = mediaTrack('microphone-2', 'audio');

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.setLocalStream(mediaStreamWithTracks([initialMicrophone]));

    await manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );

    const [peer] = peers;
    const [microphoneSender] = peer.senders as unknown as FakeSender[];

    manager.setLocalStream(mediaStreamWithTracks([nextMicrophone]));

    expect(microphoneSender.replaceTrack).toHaveBeenCalledWith(nextMicrophone);
    expect(peer.removeTrack).not.toHaveBeenCalled();
    expect(peer.addTrack).toHaveBeenCalledTimes(1);
  });

  it('loads fresh ICE configuration for each new peer connection', async () => {
    const peers: FakePeerConnection[] = [];
    const configurations: RTCConfiguration[] = [];

    installPeerConnectionMock(peers, configurations);
    const manager = callPeerConnectionManager();
    const firstConfiguration: RTCConfiguration = {
      iceServers: [
        {
          credential: 'turn-password-1',
          urls: ['turn:relay-one.example.test', 'turns:relay-one.example.test'],
          username: 'turn-user-1',
        },
      ],
      iceTransportPolicy: 'relay',
    };
    const secondConfiguration: RTCConfiguration = {
      iceServers: [
        {
          credential: 'turn-password-2',
          urls: 'turn:relay-two.example.test',
          username: 'turn-user-2',
        },
      ],
      iceTransportPolicy: 'all',
    };
    const rtcConfigurationProvider = jest
      .fn()
      .mockResolvedValueOnce(firstConfiguration)
      .mockResolvedValueOnce(secondConfiguration);

    manager.configure(rtcConfigurationProvider);

    await manager.ensurePeer('peer-identity-id-1', false, () =>
      Promise.resolve(),
    );
    await manager.ensurePeer('peer-identity-id-2', false, () =>
      Promise.resolve(),
    );
    await manager.ensurePeer('peer-identity-id-1', false, () =>
      Promise.resolve(),
    );

    expect(rtcConfigurationProvider).toHaveBeenCalledTimes(2);
    expect(configurations).toEqual([firstConfiguration, secondConfiguration]);
  });

  it('refreshes TURN credentials before restarting a failed peer without downgrading relay policy', async () => {
    jest.useFakeTimers();
    const peers: FakePeerConnection[] = [];

    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();

    const provider = jest
      .fn()
      .mockResolvedValueOnce({ iceServers: [] })
      .mockResolvedValue({
        iceServers: [
          {
            credential: 'fresh-credential',
            urls: 'turn:relay.example.test',
            username: 'fresh-user',
          },
        ],
        iceTransportPolicy: 'all',
      });
    manager.configure(provider);
    await manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );

    const [peer] = peers;
    const connectionStateListener = registeredPeerEventListener(
      peer,
      'connectionstatechange',
    );

    peer.connectionState = 'failed';
    peer.iceConnectionState = 'failed';
    connectionStateListener(new Event('connectionstatechange'));
    await jest.advanceTimersByTimeAsync(0);

    expect(provider).toHaveBeenCalledTimes(2);
    expect(peer.setConfiguration).toHaveBeenCalledWith({
      iceServers: [
        {
          credential: 'fresh-credential',
          urls: 'turn:relay.example.test',
          username: 'fresh-user',
        },
      ],
      iceTransportPolicy: 'relay',
    });
    expect(peer.restartIce).toHaveBeenCalledTimes(1);
  });

  it('exposes exhausted recovery and retries only the failed connection with fresh credentials', async () => {
    jest.useFakeTimers();
    const peers: FakePeerConnection[] = [];
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const provider = jest.fn().mockResolvedValue({ iceServers: [] });
    manager.configure(provider);
    await manager.ensurePeer('failed-peer', false, () => Promise.resolve());
    await manager.ensurePeer('healthy-peer', false, () => Promise.resolve());
    peers.forEach((peer) =>
      Object.assign(peer, { getStats: () => Promise.resolve(new Map()) }),
    );
    const [failed, healthy] = peers;
    healthy.connectionState = 'connected';
    healthy.iceConnectionState = 'completed';
    failed.connectionState = 'failed';
    failed.iceConnectionState = 'failed';
    registeredPeerEventListener(
      failed,
      'connectionstatechange',
    )(new Event('connectionstatechange'));
    await jest.advanceTimersByTimeAsync(45_000);
    expect((await manager.collectStats())['failed-peer'].recoveryState).toBe(
      'exhausted',
    );
    expect((await manager.collectStats())['healthy-peer'].recoveryState).toBe(
      'idle',
    );
    expect(failed.restartIce).toHaveBeenCalledTimes(3);
    manager.retryConnections();
    manager.retryConnections();
    await jest.advanceTimersByTimeAsync(0);
    expect(provider).toHaveBeenCalledTimes(6);
    expect(failed.restartIce).toHaveBeenCalledTimes(4);
    expect(healthy.restartIce).not.toHaveBeenCalled();
    expect((await manager.collectStats())['failed-peer'].recoveryState).toBe(
      'recovering',
    );
    manager.reset();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(failed.restartIce).toHaveBeenCalledTimes(4);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('restarts the designated offerer first after a disruption and the polite peer only if still unhealthy', async () => {
    jest.useFakeTimers();
    const peers: FakePeerConnection[] = [];
    installSessionDescriptionMock();
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    manager.configure(jest.fn().mockResolvedValue({ iceServers: [] }));
    await manager.ensurePeer('answering-peer', true, () => Promise.resolve());
    await manager.ensurePeer('offering-peer', false, () => Promise.resolve());
    const [impolite, polite] = peers;
    peers.forEach((peer) =>
      Object.assign(peer, {
        connectionState: 'disconnected',
        iceConnectionState: 'disconnected',
        localDescription: { sdp: 'local-sdp', type: 'offer' },
        remoteDescription: { sdp: 'remote-sdp', type: 'answer' },
        signalingState: 'stable',
      }),
    );

    manager.recoverAfterDisruption();
    await jest.advanceTimersByTimeAsync(0);
    expect(impolite.restartIce).toHaveBeenCalledTimes(1);
    expect(polite.restartIce).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(3_000);
    expect(polite.restartIce).toHaveBeenCalledTimes(1);
    manager.reset();
  });

  it('re-sends an unanswered offer so a lost answer recovers and a retry stays effective', async () => {
    jest.useFakeTimers();
    const peers: FakePeerConnection[] = [];
    installSessionDescriptionMock();
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const provider = jest.fn().mockResolvedValue({ iceServers: [] });
    const sendSignal = jest
      .fn<Promise<void>, Parameters<SignalSender>>()
      .mockResolvedValue(undefined);
    manager.configure(provider);
    manager.setLocalStream(
      mediaStreamWithTracks([mediaTrack('microphone', 'audio')]),
    );
    await manager.ensurePeer('remote-identity-id', true, sendSignal);
    const [peer] = peers;
    Object.assign(peer, { getStats: () => Promise.resolve(new Map()) });
    const offers = () =>
      sendSignal.mock.calls.filter(([, signalType]) => signalType === 'offer');
    const recoveryState = async () =>
      (await manager.collectStats())['remote-identity-id'].recoveryState;
    registeredPeerEventListener(
      peer,
      'signalingstatechange',
    )(new Event('signalingstatechange'));
    expect(offers()).toHaveLength(1);

    await jest.advanceTimersByTimeAsync(14_999);
    expect(offers()).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(1);

    expect(offers()).toHaveLength(2);
    // The remote peer may hold the session it answered: only the same offer
    // renegotiates it consistently.
    expect(offers()[1]).toEqual(offers()[0]);
    expect(peer.createOffer).toHaveBeenCalledTimes(1);
    expect(peer.signalingState).toBe('have-local-offer');
    expect(await recoveryState()).toBe('recovering');

    await jest.advanceTimersByTimeAsync(45_000);
    expect(offers()).toHaveLength(4);
    expect(await recoveryState()).toBe('exhausted');

    manager.retryConnections();
    await jest.advanceTimersByTimeAsync(0);
    expect(offers()).toHaveLength(5);
    expect(await recoveryState()).toBe('recovering');
    manager.reset();
  });

  it('retries a timed-out offer and keeps recovery able to re-send it', async () => {
    jest.useFakeTimers();
    const peers: FakePeerConnection[] = [];
    installSessionDescriptionMock();
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const timeout = new DOMException('Call signal timed out.', 'TimeoutError');
    const sendSignal = jest
      .fn<Promise<void>, Parameters<SignalSender>>()
      .mockRejectedValueOnce(timeout)
      .mockRejectedValueOnce(timeout)
      .mockRejectedValueOnce(timeout)
      .mockRejectedValueOnce(timeout)
      .mockResolvedValue(undefined);
    const offers = () =>
      sendSignal.mock.calls.filter(([, signalType]) => signalType === 'offer');
    manager.configure(jest.fn().mockResolvedValue({ iceServers: [] }));
    const ensured = manager
      .ensurePeer('remote-identity-id', true, sendSignal)
      .catch((error: unknown) => error);
    await jest.advanceTimersByTimeAsync(0);
    const [peer] = peers;
    registeredPeerEventListener(
      peer,
      'signalingstatechange',
    )(new Event('signalingstatechange'));

    await jest.advanceTimersByTimeAsync(3_500);
    await expect(ensured).resolves.toBe(timeout);
    expect(offers()).toHaveLength(4);

    await jest.advanceTimersByTimeAsync(11_500);
    expect(offers()).toHaveLength(5);
    expect(offers()[4]).toEqual(offers()[0]);
    manager.reset();
  });

  it.each([
    ['configuration', 'peer-manager:ice-recovery:configuration-unavailable'],
    ['signal', 'peer-manager:ice-recovery:offer-undelivered'],
    ['ice-restart', 'peer-manager:ice-recovery:restart-failed'],
  ])('logs a %s recovery failure by its reason', async (reason, event) => {
    jest.useFakeTimers();
    const peers: FakePeerConnection[] = [];
    installSessionDescriptionMock();
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const provider = jest.fn().mockResolvedValue({ iceServers: [] });
    const sendSignal = jest
      .fn<Promise<void>, Parameters<SignalSender>>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValue(new HttpJsonError(403, 'Forbidden', ''));

    if (reason === 'configuration')
      provider
        .mockResolvedValueOnce({ iceServers: [] })
        .mockRejectedValueOnce(new Error('credential endpoint down'));
    manager.configure(provider);
    startCallDiagnostics();
    try {
      await manager.ensurePeer(
        'peer-identity-id',
        reason === 'signal',
        sendSignal,
      );
      const [peer] = peers;

      if (reason === 'ice-restart')
        (peer.restartIce as jest.Mock).mockImplementation(() => {
          throw new Error('restart rejected');
        });

      if (reason !== 'signal') {
        peer.connectionState = 'failed';
        peer.iceConnectionState = 'failed';
      }
      registeredPeerEventListener(
        peer,
        'signalingstatechange',
      )(new Event('signalingstatechange'));
      await jest.advanceTimersByTimeAsync(15_000);

      const events = readCallDiagnostics().events.map(
        (diagnostic) => diagnostic.event,
      );
      expect(events).toContain(event);
      expect(
        new Set(
          events.filter((logged) =>
            [
              'peer-manager:ice-recovery:configuration-unavailable',
              'peer-manager:ice-recovery:offer-undelivered',
              'peer-manager:ice-recovery:restart-failed',
            ].includes(logged),
          ),
        ),
      ).toEqual(new Set([event]));
      expect(JSON.stringify(readCallDiagnostics())).not.toMatch(
        /credential endpoint|restart rejected|offer-sdp/,
      );
    } finally {
      stopCallDiagnostics();
      manager.reset();
    }
  });

  it('bounds a callee that never receives an offer and requests one', async () => {
    jest.useFakeTimers();
    const peers: FakePeerConnection[] = [];
    installSessionDescriptionMock();
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const sendSignal = jest
      .fn<Promise<void>, Parameters<SignalSender>>()
      .mockResolvedValue(undefined);
    const offers = () =>
      sendSignal.mock.calls.filter(([, signalType]) => signalType === 'offer');
    const recoveryState = async () =>
      (await manager.collectStats())['offerer-identity-id'].recoveryState;
    manager.configure(jest.fn().mockResolvedValue({ iceServers: [] }));
    manager.setLocalStream(
      mediaStreamWithTracks([mediaTrack('microphone', 'audio')]),
    );
    await manager.ensurePeer('offerer-identity-id', false, sendSignal);
    const [peer] = peers;
    Object.assign(peer, { getStats: () => Promise.resolve(new Map()) });
    expect(await recoveryState()).toBe('idle');

    await jest.advanceTimersByTimeAsync(14_999);
    expect(offers()).toHaveLength(0);
    await jest.advanceTimersByTimeAsync(1);
    expect(offers()).toHaveLength(1);
    expect(await recoveryState()).toBe('recovering');

    await jest.advanceTimersByTimeAsync(45_000);
    expect(offers()).toHaveLength(3);
    expect(peer.createOffer).toHaveBeenCalledTimes(1);
    expect(await recoveryState()).toBe('exhausted');

    manager.retryConnections();
    await jest.advanceTimersByTimeAsync(0);
    expect(offers()).toHaveLength(4);
    expect(await recoveryState()).toBe('recovering');
    manager.reset();
  });

  it('answers a requested offer during glare by re-sending its own offer', async () => {
    const peers: FakePeerConnection[] = [];
    installSessionDescriptionMock();
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const sendSignal = jest
      .fn<Promise<void>, Parameters<SignalSender>>()
      .mockResolvedValue(undefined);
    manager.configure(jest.fn().mockResolvedValue({ iceServers: [] }));
    await manager.ensurePeer('identity-b', true, sendSignal);
    const [peer] = peers;

    await manager.handleSignal(
      'identity-b',
      'offer',
      { sdp: 'callee-offer-sdp', type: 'offer' },
      sendSignal,
      'identity-a',
    );

    expect(peer.setRemoteDescription).not.toHaveBeenCalled();
    expect(sendSignal.mock.calls.map(([, signalType]) => signalType)).toEqual([
      'offer',
      'offer',
    ]);
    expect(sendSignal.mock.calls[1]).toEqual(sendSignal.mock.calls[0]);
    manager.reset();
  });

  it('answers the same offer arriving twice at once one after another', async () => {
    const peers: FakePeerConnection[] = [];
    installSessionDescriptionMock();
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const sendSignal = jest
      .fn<Promise<void>, Parameters<SignalSender>>()
      .mockResolvedValue(undefined);
    manager.configure(jest.fn().mockResolvedValue({ iceServers: [] }));
    await manager.ensurePeer('identity-a', false, sendSignal);
    const [peer] = peers;
    const applyLocal = jest.mocked(peer.setLocalDescription);
    const setLocalDescription = applyLocal.getMockImplementation();

    applyLocal.mockImplementation((description) =>
      description?.type === 'answer' && peer.signalingState === 'stable'
        ? Promise.reject(new Error('Called in wrong state: stable'))
        : (setLocalDescription?.(description) ?? Promise.resolve()),
    );
    const offer = () =>
      manager.handleSignal(
        'identity-a',
        'offer',
        { sdp: 'offer-sdp', type: 'offer' },
        sendSignal,
        'identity-b',
      );

    await expect(Promise.all([offer(), offer()])).resolves.toEqual([
      undefined,
      undefined,
    ]);
    expect(sendSignal.mock.calls.map(([, signalType]) => signalType)).toEqual([
      'answer',
      'answer',
    ]);
    manager.reset();
  });

  describe('crossed offers of two connections (#560)', () => {
    const first = 'sha-256 A1:A1';
    const second = 'sha-256 A2:A2';
    const third = 'sha-256 A3:A3';
    let peers: FakePeerConnection[];
    let manager: CallPeerConnections;
    let sendSignal: jest.Mock<Promise<void>, Parameters<SignalSender>>;

    /** The connection that answered, wherever it was created. */
    function answeringConnection(): FakePeerConnection {
      const answering = peers.find(
        ({ localDescription }) => localDescription?.type === 'answer',
      );

      if (!answering) throw new Error('No connection answered.');

      return answering;
    }

    /** Makes `peer` ask the other side to restart ICE, as its own offer. */
    async function offerRestart(peer: FakePeerConnection): Promise<void> {
      await peer.setLocalDescription(await peer.createOffer());
    }

    beforeEach(() => {
      peers = [];
      installEncodedStreamSupport();
      installScriptTransformSupport();
      installSessionDescriptionMock();
      installPeerConnectionMock(peers);
      manager = callPeerConnectionManager();
      sendSignal = jest
        .fn<Promise<void>, Parameters<SignalSender>>()
        .mockResolvedValue(undefined);
      manager.configure(() => Promise.resolve({ iceServers: [] }));
    });

    afterEach(() => {
      manager.reset();
    });

    it('answers an offer that crosses its own on a new connection, not on a rolled back one', async () => {
      manager.configureMediaEncryption(
        { callId: 'call-id', senderId: 'bob' },
        callKey(),
      );
      manager.setLocalStream(
        mediaStreamWithTracks([mediaTrack('microphone', 'audio')]),
      );
      await manager.ensurePeer('alice', false, sendSignal);
      const [crossed] = peers;
      await offerRestart(crossed);

      await manager.handleSignal(
        'alice',
        'offer',
        { ...describedBy('offer', first), mediaEncryption: encryptedMedia },
        sendSignal,
        'bob',
      );

      const answering = answeringConnection();

      expect(untransformed(answering)).toEqual([]);
      expect(peers).toHaveLength(2);
      expect(answering).not.toBe(crossed);
      expect(crossed.close).toHaveBeenCalledTimes(1);
      expect(crossed.setLocalDescription).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'rollback' }),
      );
      expect(crossed.setRemoteDescription).not.toHaveBeenCalled();
      expect(answering.remoteDescription).toEqual(
        expect.objectContaining({
          sdp: describedBy('offer', first).sdp,
          type: 'offer',
        }),
      );
      expect(sendSignal).toHaveBeenCalledWith(
        'alice',
        'answer',
        expect.objectContaining({ type: 'answer' }),
      );
    });

    it('keeps its connection for the next offer of the connection it knows', async () => {
      await manager.ensurePeer('alice', false, sendSignal);
      await manager.handleSignal(
        'alice',
        'offer',
        describedBy('offer', first),
        sendSignal,
        'bob',
      );

      await manager.handleSignal(
        'alice',
        'offer',
        describedBy('offer', first, 2),
        sendSignal,
        'bob',
      );

      expect(peers).toHaveLength(1);
      expect(peers[0].close).not.toHaveBeenCalled();
      expect(peers[0].remoteDescription).toEqual(
        describedBy('offer', first, 2),
      );
      expect(sendSignal).toHaveBeenCalledTimes(2);
    });

    it('ignores an offer that crosses its own and keeps its connection when it is the impolite side', async () => {
      await manager.ensurePeer('bob', true, sendSignal);
      const [crossed] = peers;
      await manager.handleSignal(
        'bob',
        'answer',
        describedBy('answer', first),
        sendSignal,
        'alice',
      );
      await offerRestart(crossed);

      await manager.handleSignal(
        'bob',
        'offer',
        describedBy('offer', first, 2),
        sendSignal,
        'alice',
      );

      expect(peers).toHaveLength(1);
      expect(crossed.close).not.toHaveBeenCalled();
      expect(crossed.setRemoteDescription).toHaveBeenCalledTimes(1);
      expect(crossed.signalingState).toBe('have-local-offer');
    });

    it.each([
      { current: 'alice', remote: 'bob' },
      { current: 'bob', remote: 'alice' },
    ])(
      'answers the offer of a new remote connection on a new connection ($current)',
      async ({ current, remote }) => {
        await manager.ensurePeer(remote, false, sendSignal);
        const [known] = peers;
        await manager.handleSignal(
          remote,
          'offer',
          describedBy('offer', first),
          sendSignal,
          current,
        );

        await manager.handleSignal(
          remote,
          'offer',
          describedBy('offer', second),
          sendSignal,
          current,
        );

        expect(peers).toHaveLength(2);
        expect(known.close).toHaveBeenCalledTimes(1);
        expect(known.setRemoteDescription).toHaveBeenCalledTimes(1);
        expect(peers[1].remoteDescription).toEqual(
          describedBy('offer', second),
        );
        expect(peers[1].localDescription?.type).toBe('answer');
        expect(sendSignal).toHaveBeenCalledTimes(2);
      },
    );

    it('offers again on a new connection when the answer to its restart comes from a new remote connection', async () => {
      await manager.ensurePeer('bob', true, sendSignal);
      const [crossed] = peers;
      await manager.handleSignal(
        'bob',
        'answer',
        describedBy('answer', first),
        sendSignal,
        'alice',
      );
      await offerRestart(crossed);
      sendSignal.mockClear();

      await manager.handleSignal(
        'bob',
        'answer',
        describedBy('answer', second),
        sendSignal,
        'alice',
      );

      expect(crossed.close).toHaveBeenCalledTimes(1);
      expect(crossed.setRemoteDescription).toHaveBeenCalledTimes(1);
      expect(peers).toHaveLength(2);
      expect(peers[1].setRemoteDescription).not.toHaveBeenCalled();
      expect(peers[1].localDescription?.type).toBe('offer');
      expect(sendSignal).toHaveBeenCalledTimes(1);
      expect(sendSignal).toHaveBeenCalledWith(
        'bob',
        'offer',
        expect.objectContaining({ type: 'offer' }),
      );
    });

    it('drops the descriptions of a remote connection it replaced', async () => {
      await manager.ensurePeer('bob', true, sendSignal);
      const [crossed] = peers;
      await manager.handleSignal(
        'bob',
        'answer',
        describedBy('answer', first),
        sendSignal,
        'alice',
      );
      await offerRestart(crossed);
      await manager.handleSignal(
        'bob',
        'answer',
        describedBy('answer', second),
        sendSignal,
        'alice',
      );
      sendSignal.mockClear();

      // The same answer once more, and an offer of the connection before it.
      await manager.handleSignal(
        'bob',
        'answer',
        describedBy('answer', second, 2),
        sendSignal,
        'alice',
      );
      await manager.handleSignal(
        'bob',
        'offer',
        describedBy('offer', first, 3),
        sendSignal,
        'alice',
      );

      expect(peers).toHaveLength(2);
      expect(peers[1].setRemoteDescription).not.toHaveBeenCalled();
      expect(sendSignal).not.toHaveBeenCalled();

      await manager.handleSignal(
        'bob',
        'answer',
        describedBy('answer', third),
        sendSignal,
        'alice',
      );

      expect(peers).toHaveLength(2);
      expect(peers[1].remoteDescription).toEqual(describedBy('answer', third));
      expect(peers[1].signalingState).toBe('stable');
    });

    it('keeps the candidates it queued for the offer that made it replace its connection', async () => {
      Object.defineProperty(globalThis, 'RTCIceCandidate', {
        configurable: true,
        value: jest.fn((candidate: RTCIceCandidateInit) => candidate),
      });
      const offer = describedBy('offer', first);
      const candidate = {
        candidate: 'candidate:1',
        sdpMid: '0',
        usernameFragment: `${first}-1`,
      };
      await manager.ensurePeer('alice', false, sendSignal);
      await offerRestart(peers[0]);
      await manager.handleSignal(
        'alice',
        'ice_candidate',
        candidate,
        sendSignal,
        'bob',
      );

      await manager.handleSignal('alice', 'offer', offer, sendSignal, 'bob');

      expect(peers).toHaveLength(2);
      expect(peers[0].addIceCandidate).not.toHaveBeenCalled();
      expect(peers[1].addIceCandidate).toHaveBeenCalledWith(candidate);
    });

    it.each(['alice', 'bob'])(
      'ends with one working connection each when both sides restart ICE and their offers cross (%s delivered first)',
      async (deliveredFirst) => {
        const connections: FakePeerConnection[] = [];
        const configurations: RTCConfiguration[] = [];
        installPeerConnectionMock(connections, configurations);
        const alice = encryptedCallSide('alice');
        const bob = encryptedCallSide('bob');
        await alice.manager.ensurePeer('bob', true, alice.sendSignal);
        await bob.manager.ensurePeer('alice', false, bob.sendSignal);
        await converse(alice, bob);

        for (const side of [alice, bob]) {
          const [established] = connectionsOf(
            side,
            connections,
            configurations,
          );

          registeredPeerEventListener(
            established,
            'negotiationneeded',
          )(new Event('negotiationneeded'));
        }
        await (deliveredFirst === 'alice'
          ? converse(alice, bob)
          : converse(bob, alice));

        const [aliceConnections, bobConnections] = [alice, bob].map((side) =>
          connectionsOf(side, connections, configurations),
        );
        const aliceNow = aliceConnections[aliceConnections.length - 1];
        const bobNow = bobConnections[bobConnections.length - 1];

        expect(untransformed(aliceNow)).toEqual([]);
        expect(untransformed(bobNow)).toEqual([]);
        expect([aliceNow.signalingState, bobNow.signalingState]).toEqual([
          'stable',
          'stable',
        ]);
        expect(fingerprintOf(aliceNow.remoteDescription)).toBe(
          fingerprintOf(bobNow.localDescription),
        );
        expect(fingerprintOf(bobNow.remoteDescription)).toBe(
          fingerprintOf(aliceNow.localDescription),
        );
        expect(aliceNow.close).not.toHaveBeenCalled();
        expect(bobNow.close).not.toHaveBeenCalled();
        for (const replaced of [
          ...aliceConnections.slice(0, -1),
          ...bobConnections.slice(0, -1),
        ]) {
          expect(replaced.close).toHaveBeenCalledTimes(1);
        }
        alice.manager.reset();
        bob.manager.reset();
      },
    );
  });

  it.each(['reset', 'healthy', 'timeout'])(
    'discards late TURN credentials after %s',
    async (reason) => {
      jest.useFakeTimers();
      const peers: FakePeerConnection[] = [];
      installPeerConnectionMock(peers);
      const manager = callPeerConnectionManager();
      let resolveRefresh!: (configuration: RTCConfiguration) => void;
      const provider = jest
        .fn()
        .mockResolvedValueOnce({ iceServers: [] })
        .mockImplementation(
          () =>
            new Promise<RTCConfiguration>((resolve) => {
              resolveRefresh = resolve;
            }),
        );
      manager.configure(provider);
      await manager.ensurePeer('peer-identity-id', false, async () => {});
      const [peer] = peers;
      const listener = registeredPeerEventListener(
        peer,
        'connectionstatechange',
      );
      peer.connectionState = 'failed';
      peer.iceConnectionState = 'failed';
      listener(new Event('connectionstatechange'));
      await jest.advanceTimersByTimeAsync(0);
      listener(new Event('connectionstatechange'));
      expect(provider).toHaveBeenCalledTimes(2);
      expect(peer.restartIce).not.toHaveBeenCalled();

      if (reason === 'reset') manager.reset();

      if (reason === 'healthy') {
        peer.connectionState = 'connected';
        peer.iceConnectionState = 'connected';
        listener(new Event('connectionstatechange'));
      }

      if (reason === 'timeout') await jest.advanceTimersByTimeAsync(15_000);
      resolveRefresh({
        iceServers: [
          { credential: 'late-secret', urls: 'turn:late.example.test' },
        ],
      });
      await jest.advanceTimersByTimeAsync(0);

      expect(peer.setConfiguration).not.toHaveBeenCalled();
      expect(peer.restartIce).not.toHaveBeenCalled();
      manager.reset();
      expect(jest.getTimerCount()).toBe(0);
    },
  );

  it('retries a failed credential refresh without restarting with stale credentials', async () => {
    jest.useFakeTimers();
    const peers: FakePeerConnection[] = [];
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const provider = jest
      .fn()
      .mockResolvedValueOnce({ iceServers: [] })
      .mockRejectedValueOnce(
        new Error('sensitive HTTP response must not be logged'),
      )
      .mockResolvedValue({ iceServers: [{ urls: 'turn:fresh.example.test' }] });
    manager.configure(provider);
    await manager.ensurePeer('peer-identity-id', false, async () => {});
    const [peer] = peers;
    peer.connectionState = 'failed';
    peer.iceConnectionState = 'failed';
    registeredPeerEventListener(
      peer,
      'connectionstatechange',
    )(new Event('connectionstatechange'));
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await jest.advanceTimersByTimeAsync(0);
      expect(peer.restartIce).not.toHaveBeenCalled();
      expect(peer.setConfiguration).not.toHaveBeenCalled();
      expect(JSON.stringify(warning.mock.calls)).not.toContain(
        'sensitive HTTP response',
      );
      await jest.advanceTimersByTimeAsync(15_000);
      expect(provider).toHaveBeenCalledTimes(3);
      expect(peer.restartIce).toHaveBeenCalledTimes(1);
    } finally {
      warning.mockRestore();
      manager.reset();
    }
  });

  it('does not restart ICE when a transient disconnection recovers', async () => {
    jest.useFakeTimers();
    const peers: FakePeerConnection[] = [];

    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    await manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );

    const [peer] = peers;
    const connectionStateListener = registeredPeerEventListener(
      peer,
      'connectionstatechange',
    );

    peer.connectionState = 'disconnected';
    peer.iceConnectionState = 'disconnected';
    connectionStateListener(new Event('connectionstatechange'));
    peer.connectionState = 'connected';
    peer.iceConnectionState = 'connected';
    connectionStateListener(new Event('connectionstatechange'));
    jest.runOnlyPendingTimers();

    expect(peer.restartIce).not.toHaveBeenCalled();
  });

  it('passes backend ICE configuration to the peer connection unchanged', async () => {
    const peers: FakePeerConnection[] = [];
    const configurations: RTCConfiguration[] = [];

    installPeerConnectionMock(peers, configurations);
    const manager = callPeerConnectionManager();

    manager.configure(() =>
      Promise.resolve({
        iceServers: [
          {
            urls: [
              'turn:relay.example.test:4101?transport=udp',
              'turn:relay.example.test:4101?transport=tcp',
            ],
          },
        ],
        iceTransportPolicy: 'relay',
      }),
    );

    await manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );

    expect(peers).toHaveLength(1);
    expect(configurations).toEqual([
      {
        iceServers: [
          {
            urls: [
              'turn:relay.example.test:4101?transport=udp',
              'turn:relay.example.test:4101?transport=tcp',
            ],
          },
        ],
        iceTransportPolicy: 'relay',
      },
    ]);
  });

  it('exchanges offer and answer between joined peers', async () => {
    const peers: FakePeerConnection[] = [];
    const manager = callPeerConnectionManager();
    const sentSignals: Array<{
      payload: Record<string, unknown>;
      recipientIdentityId: string;
      signalType: string;
    }> = [];

    installSessionDescriptionMock();
    installPeerConnectionMock(peers);
    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.setLocalStream(
      mediaStreamWithTracks([mediaTrack('microphone', 'audio')]),
    );

    await manager.ensurePeer(
      'remote-identity-id',
      true,
      (recipientIdentityId, signalType, payload) => {
        sentSignals.push({ payload, recipientIdentityId, signalType });

        return Promise.resolve();
      },
    );

    const [peer] = peers;
    const offerSignal = sentSignals.find(
      (signal) => signal.signalType === 'offer',
    );

    expect(offerSignal).toMatchObject({
      payload: expect.objectContaining({ type: 'offer' }),
      recipientIdentityId: 'remote-identity-id',
      signalType: 'offer',
    });
    expect(peer.localDescription).toMatchObject({ type: 'offer' });

    await manager.handleSignal(
      'remote-identity-id',
      'answer',
      {
        sdp: 'remote-answer-sdp',
        type: 'answer',
      },
      (recipientIdentityId, signalType, payload) => {
        sentSignals.push({ payload, recipientIdentityId, signalType });

        return Promise.resolve();
      },
      'current-identity-id',
    );

    expect(peer.remoteDescription).toMatchObject({
      sdp: 'remote-answer-sdp',
      type: 'answer',
    });
    expect(peer.signalingState).toBe('stable');
  });

  it('ignores a delayed answer after reset and negotiates the next call', async () => {
    const peers: FakePeerConnection[] = [];
    const manager = callPeerConnectionManager();
    const sendSignal = jest.fn(() => Promise.resolve());

    installSessionDescriptionMock();
    installPeerConnectionMock(peers);
    manager.configure(() => Promise.resolve({ iceServers: [] }));
    await manager.ensurePeer('remote', true, sendSignal);
    manager.reset();
    manager.configure(() => Promise.resolve({ iceServers: [] }));

    await manager.handleSignal(
      'remote',
      'answer',
      {
        sdp: 'previous-call-answer',
        type: 'answer',
      },
      sendSignal,
      'local',
    );

    const peer = peers[1];

    expect(peer.remoteDescription).toBeNull();
    expect(peer.signalingState).toBe('stable');
    await manager.ensurePeer('remote', true, sendSignal);
    await manager.handleSignal(
      'remote',
      'answer',
      {
        sdp: 'current-call-answer',
        type: 'answer',
      },
      sendSignal,
      'local',
    );
    expect(peer.remoteDescription?.sdp).toBe('current-call-answer');
    expect(peer.signalingState).toBe('stable');
  });

  it.each([
    { during: false, glare: false },
    { during: false, glare: true },
    { during: true, glare: true },
  ])(
    'keeps early answer candidates until their restart description arrives (glare=$glare, applying=$during)',
    async ({ during, glare }) => {
      const peers: FakePeerConnection[] = [];
      installSessionDescriptionMock();
      installPeerConnectionMock(peers);
      Object.defineProperty(globalThis, 'RTCIceCandidate', {
        configurable: true,
        value: jest.fn((candidate: RTCIceCandidateInit) => candidate),
      });
      const manager = callPeerConnectionManager();
      manager.configure(() => Promise.resolve({ iceServers: [] }));
      const sendSignal = jest.fn().mockResolvedValue(undefined);
      await manager.ensurePeer('bob', true, sendSignal);
      await manager.handleSignal(
        'bob',
        'answer',
        { sdp: 'v=0\r\na=ice-ufrag:old\r\n', type: 'answer' },
        sendSignal,
        'alice',
      );
      const peer = peers[0];
      await peer.setLocalDescription({ sdp: 'restart-offer', type: 'offer' });

      if (glare)
        await manager.handleSignal(
          'bob',
          'offer',
          { sdp: 'v=0\r\na=ice-ufrag:ignored\r\n', type: 'offer' },
          sendSignal,
          'alice',
        );
      const applyAnswer = () =>
        manager.handleSignal(
          'bob',
          'answer',
          { sdp: 'v=0\r\na=ice-ufrag:new\r\n', type: 'answer' },
          sendSignal,
          'alice',
        );
      let acceptingAnswer: Promise<void> | undefined;
      let finishAnswer: (() => void) | undefined;

      if (during) {
        const original = jest
          .mocked(peer.setRemoteDescription)
          .getMockImplementation()!;
        let started!: () => void;
        const applying = new Promise<void>((resolve) => {
          started = resolve;
        });
        jest
          .mocked(peer.setRemoteDescription)
          .mockImplementationOnce((description) => {
            started();

            return new Promise<void>((resolve) => {
              finishAnswer = () => {
                void original(description).then(resolve);
              };
            });
          });
        acceptingAnswer = applyAnswer();
        await applying;
      }
      for (const fragment of ['old', 'ignored', 'new'])
        await manager.handleSignal(
          'bob',
          'ice_candidate',
          {
            candidate: 'candidate:' + fragment,
            sdpMid: '0',
            usernameFragment: fragment,
          },
          sendSignal,
          'alice',
        );
      expect(peer.addIceCandidate).not.toHaveBeenCalled();

      finishAnswer?.();
      await (acceptingAnswer ?? applyAnswer());

      expect(peer.addIceCandidate).toHaveBeenCalledTimes(1);
      expect(peer.addIceCandidate).toHaveBeenCalledWith(
        expect.objectContaining({ usernameFragment: 'new' }),
      );
      manager.reset();
    },
  );

  it.each([{ during: false }, { during: true }])(
    'adds remote restart candidates that arrive before their offer is applied (applying=$during)',
    async ({ during }) => {
      const peers: FakePeerConnection[] = [];
      installSessionDescriptionMock();
      installPeerConnectionMock(peers);
      Object.defineProperty(globalThis, 'RTCIceCandidate', {
        configurable: true,
        value: jest.fn((candidate: RTCIceCandidateInit) => candidate),
      });
      const manager = callPeerConnectionManager();
      manager.configure(() => Promise.resolve({ iceServers: [] }));
      const sendSignal = jest.fn().mockResolvedValue(undefined);
      const receiveOffer = (fragment: string) =>
        manager.handleSignal(
          'bob',
          'offer',
          { sdp: `v=0\r\na=ice-ufrag:${fragment}\r\n`, type: 'offer' },
          sendSignal,
          'alice',
        );
      await receiveOffer('old');
      const peer = peers[0];
      let applyingRestart: Promise<void> | undefined;
      let finishRestart: (() => void) | undefined;

      if (during) {
        const original = jest
          .mocked(peer.setRemoteDescription)
          .getMockImplementation()!;
        let started!: () => void;
        const applying = new Promise<void>((resolve) => {
          started = resolve;
        });
        jest
          .mocked(peer.setRemoteDescription)
          .mockImplementationOnce((description) => {
            started();

            return new Promise<void>((resolve) => {
              finishRestart = () => {
                void original(description).then(resolve);
              };
            });
          });
        applyingRestart = receiveOffer('new');
        await applying;
      }
      await manager.handleSignal(
        'bob',
        'ice_candidate',
        { candidate: 'candidate:new', sdpMid: '0', usernameFragment: 'new' },
        sendSignal,
        'alice',
      );
      expect(peer.addIceCandidate).not.toHaveBeenCalled();

      finishRestart?.();
      await (applyingRestart ?? receiveOffer('new'));

      expect(peer.addIceCandidate).toHaveBeenCalledTimes(1);
      expect(peer.addIceCandidate).toHaveBeenCalledWith(
        expect.objectContaining({ usernameFragment: 'new' }),
      );
      manager.reset();
    },
  );

  it.each([
    { arrival: 'before', fragment: 'old' },
    { arrival: 'after', fragment: 'old' },
    { arrival: 'before', fragment: undefined },
  ])(
    'preserves current ICE candidates with stale ICE $arrival the ignored answer and fragment $fragment',
    async ({ arrival, fragment }) => {
      const peers: FakePeerConnection[] = [];
      const manager = callPeerConnectionManager();
      const sendSignal = jest.fn(() => Promise.resolve());
      const stale = {
        candidate: 'candidate:old',
        sdpMid: '0',
        usernameFragment: fragment,
      };
      const current = {
        candidate: 'candidate:new',
        sdpMid: '0',
        usernameFragment: 'new',
      };

      installSessionDescriptionMock();
      installPeerConnectionMock(peers);
      Object.defineProperty(globalThis, 'RTCIceCandidate', {
        configurable: true,
        value: jest.fn((candidate: RTCIceCandidateInit) => candidate),
      });
      manager.configure(() => Promise.resolve({ iceServers: [] }));
      await manager.ensurePeer('remote', true, sendSignal);
      manager.reset();
      manager.configure(() => Promise.resolve({ iceServers: [] }));
      const deliverStale = async (): Promise<void> => {
        await manager.handleSignal(
          'remote',
          'ice_candidate',
          stale,
          sendSignal,
          'local',
        );
      };

      if (arrival === 'before') await deliverStale();
      await manager.handleSignal(
        'remote',
        'answer',
        {
          sdp: 'v=0\r\na=ice-ufrag:old\r\n',
          type: 'answer',
        },
        sendSignal,
        'local',
      );

      if (arrival === 'after') await deliverStale();
      const peer = peers[1];

      const addIceCandidate = jest
        .spyOn(peer, 'addIceCandidate')
        .mockImplementation((candidate) => {
          if (candidate?.usernameFragment !== 'new') {
            return Promise.reject(
              new DOMException('ICE generation mismatch', 'OperationError'),
            );
          }

          return Promise.resolve();
        });
      await manager.handleSignal(
        'remote',
        'ice_candidate',
        current,
        sendSignal,
        'local',
      );
      await manager.ensurePeer('remote', true, sendSignal);
      await expect(
        manager.handleSignal(
          'remote',
          'answer',
          {
            sdp: 'v=0\r\na=ice-ufrag:new\r\n',
            type: 'answer',
          },
          sendSignal,
          'local',
        ),
      ).resolves.toBeUndefined();
      expect(peer.addIceCandidate).toHaveBeenCalledTimes(fragment ? 1 : 2);
      expect(peer.addIceCandidate).toHaveBeenLastCalledWith(current);
      await expect(deliverStale()).resolves.toBeUndefined();
      expect(peer.addIceCandidate).toHaveBeenCalledTimes(fragment ? 1 : 3);
      addIceCandidate.mockRejectedValueOnce(
        new DOMException('Peer closed', 'InvalidStateError'),
      );
      await expect(
        manager.handleSignal(
          'remote',
          'ice_candidate',
          current,
          sendSignal,
          'local',
        ),
      ).rejects.toMatchObject({ name: 'InvalidStateError' });
    },
  );

  it('falls back to encoded streams on a Chromium without RTCRtpScriptTransform', async () => {
    const peers: FakePeerConnection[] = [];
    const configurations: RtcConfigurationWithEncodedInsertableStreams[] = [];

    installEncodedStreamSupport();
    installPeerConnectionMock(peers, configurations);
    const manager = callPeerConnectionManager();
    const microphone = mediaTrack('microphone-1', 'audio');

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.configureMediaEncryption(ownCall, callKey());
    manager.setLocalStream(mediaStreamWithTracks([microphone]));

    await manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );

    const [peer] = peers;
    const [sender] = peer.senders as unknown as FakeSender[];

    expect(configurations[0]?.encodedInsertableStreams).toBe(true);
    expect(sender.createEncodedStreams).toHaveBeenCalledTimes(1);
  });

  it('encrypts media in a worker where the browser takes an RTCRtpScriptTransform, even with encoded streams too', async () => {
    const peers: FakePeerConnection[] = [];
    const configurations: RtcConfigurationWithEncodedInsertableStreams[] = [];

    installEncodedStreamSupport();
    const scriptTransform = installScriptTransformSupport();

    installPeerConnectionMock(peers, configurations);
    const manager = callPeerConnectionManager();

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.configureMediaEncryption(ownCall, callKey());
    manager.setLocalStream(
      mediaStreamWithTracks([mediaTrack('microphone-1', 'audio')]),
    );

    await manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );

    const [sender] = peers[0].senders as unknown as Array<
      FakeSender & { transform?: unknown }
    >;
    const [receiver] = peers[0].receivers;

    expect(configurations[0]?.encodedInsertableStreams).toBeUndefined();
    expect(sender.createEncodedStreams).not.toHaveBeenCalled();
    expect(sender.transform).toEqual({
      senderId: 'current-identity-id',
      side: 'send',
      track: 'audio',
    });
    expect(receiver.transform).toEqual({
      senderId: 'peer-identity-id',
      side: 'receive',
      track: 'audio',
    });
    expect(scriptTransform).toHaveBeenCalledTimes(2);
    manager.reset();
  });

  it('transforms both ends of a local track in the task that adds it', async () => {
    const peers: FakePeerConnection[] = [];

    installEncodedStreamSupport();
    installScriptTransformSupport();
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.configureMediaEncryption(ownCall, callKey());
    manager.setLocalStream(
      mediaStreamWithTracks([mediaTrack('microphone', 'audio')]),
    );
    await manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );

    expect(peers[0].receivers).toHaveLength(1);
    expect(untransformed(peers[0])).toEqual([]);
    manager.reset();
  });

  it('transforms the receive-only transceiver of a peer without local media', async () => {
    const peers: FakePeerConnection[] = [];

    installEncodedStreamSupport();
    installScriptTransformSupport();
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.configureMediaEncryption(ownCall, callKey());
    await manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );

    expect(peers[0].addTransceiver).toHaveBeenCalledWith('audio', {
      direction: 'recvonly',
    });
    expect(untransformed(peers[0])).toEqual([]);
    manager.reset();
  });

  it('transforms a transceiver a remote description creates as the signaling state changes', async () => {
    jest.useFakeTimers();
    const peers: FakePeerConnection[] = [];

    installEncodedStreamSupport();
    installScriptTransformSupport();
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.configureMediaEncryption(ownCall, callKey());
    manager.setLocalStream(
      mediaStreamWithTracks([mediaTrack('microphone', 'audio')]),
    );
    await manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );
    createRemoteTransceiver(peers[0], 'video');

    expect(peers[0].receivers).toHaveLength(2);
    expect(untransformed(peers[0])).toEqual([]);
    manager.reset();
  });

  it('announces encrypted media in its first offer, before the peer describes itself', async () => {
    const peers: FakePeerConnection[] = [];

    installEncodedStreamSupport();
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const sendSignal = jest.fn(() =>
      Promise.resolve(),
    ) as unknown as jest.MockedFunction<SignalSender>;

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.configureMediaEncryption(ownCall, callKey());
    manager.setLocalStream(
      mediaStreamWithTracks([mediaTrack('audio', 'audio')]),
    );

    await manager.ensurePeer('peer-identity-id', true, sendSignal);

    expect(sendSignal).toHaveBeenCalledWith(
      'peer-identity-id',
      'offer',
      expect.objectContaining({ mediaEncryption: encryptedMedia }),
    );
  });

  it('encrypts every outbound frame of a private call, before the peer describes itself', async () => {
    const peers: FakePeerConnection[] = [];
    const written: ArrayBuffer[] = [];

    installEncodedStreamSupport();
    installPeerConnectionMock(peers);
    installOutboundFrame(new Uint8Array([1, 2, 3, 4]), written);
    const manager = callPeerConnectionManager();

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.configureMediaEncryption(ownCall, callKey());
    manager.setLocalStream(
      mediaStreamWithTracks([mediaTrack('audio', 'audio')]),
    );

    await manager.ensurePeer('peer-identity-id', true, () => Promise.resolve());
    await framesWritten(written);

    expect(written).toHaveLength(1);
    expect(
      new TextDecoder().decode(new Uint8Array(written[0]).slice(0, 5)),
    ).toBe('PSCE2');
    expect(new Uint8Array(written[0]).byteLength).toBe(4 + 41);
  });

  it.each([
    ['omits media encryption', {}],
    [
      'does not accept encrypted media',
      {
        mediaEncryption: {
          acceptsEncrypted: false,
          enabled: false,
          version: 2,
        },
      },
    ],
    [
      'would send plaintext media',
      {
        mediaEncryption: { acceptsEncrypted: true, enabled: false, version: 2 },
      },
    ],
    [
      'encrypts media in the retired version 1',
      {
        mediaEncryption: { acceptsEncrypted: true, enabled: true, version: 1 },
      },
    ],
  ])(
    'refuses a peer of a private call whose offer %s',
    async (_label, metadata) => {
      const peers: FakePeerConnection[] = [];

      installEncodedStreamSupport();
      installSessionDescriptionMock();
      installPeerConnectionMock(peers);
      const manager = callPeerConnectionManager();
      const sendSignal = jest.fn(() =>
        Promise.resolve(),
      ) as unknown as jest.MockedFunction<SignalSender>;

      manager.configure(() => Promise.resolve({ iceServers: [] }));
      manager.configureMediaEncryption(ownCall, callKey());
      manager.setLocalStream(
        mediaStreamWithTracks([mediaTrack('audio', 'audio')]),
      );
      await manager.ensurePeer('peer-identity-id', false, sendSignal);

      await manager.handleSignal(
        'peer-identity-id',
        'offer',
        { ...metadata, sdp: 'plaintext-offer', type: 'offer' },
        sendSignal,
        'current-identity-id',
      );

      expect(peers[0].setRemoteDescription).not.toHaveBeenCalled();
      expect(peers[0].close).toHaveBeenCalled();
      expect(sendSignal).not.toHaveBeenCalled();
      expect(manager.isMediaEncryptionActiveWith('peer-identity-id')).toBe(
        false,
      );
    },
  );

  it('refuses a peer of a private call whose answer does not announce encrypted media', async () => {
    const peers: FakePeerConnection[] = [];

    installEncodedStreamSupport();
    installSessionDescriptionMock();
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const sendSignal = jest.fn(() =>
      Promise.resolve(),
    ) as unknown as jest.MockedFunction<SignalSender>;

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.configureMediaEncryption(ownCall, callKey());
    await manager.ensurePeer('peer-identity-id', true, sendSignal);

    await manager.handleSignal(
      'peer-identity-id',
      'answer',
      { sdp: 'plaintext-answer', type: 'answer' },
      sendSignal,
      'current-identity-id',
    );

    expect(peers[0].setRemoteDescription).not.toHaveBeenCalled();
    expect(peers[0].close).toHaveBeenCalled();
    expect(manager.isMediaEncryptionActiveWith('peer-identity-id')).toBe(false);
  });

  it('refuses every peer of a private call when this browser cannot encrypt media', async () => {
    const peers: FakePeerConnection[] = [];

    installSessionDescriptionMock();
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const sendSignal = jest.fn(() =>
      Promise.resolve(),
    ) as unknown as jest.MockedFunction<SignalSender>;

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.configureMediaEncryption(ownCall, callKey());
    await manager.ensurePeer('peer-identity-id', false, sendSignal);

    await manager.handleSignal(
      'peer-identity-id',
      'offer',
      {
        mediaEncryption: encryptedMedia,
        sdp: 'encrypted-offer',
        type: 'offer',
      },
      sendSignal,
      'current-identity-id',
    );

    expect(peers[0].setRemoteDescription).not.toHaveBeenCalled();
    expect(peers[0].close).toHaveBeenCalled();
    expect(sendSignal).not.toHaveBeenCalled();
  });

  it('adds no local media to a peer of a private call this browser cannot encrypt', async () => {
    const peers: FakePeerConnection[] = [];

    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.configureMediaEncryption(ownCall, callKey());
    manager.setLocalStream(
      mediaStreamWithTracks([mediaTrack('microphone', 'audio')]),
    );
    await manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );

    expect(peers[0].addTrack).not.toHaveBeenCalled();
    manager.reset();
  });

  it('answers a peer of a private call that announces encrypted media', async () => {
    const peers: FakePeerConnection[] = [];

    installEncodedStreamSupport();
    installSessionDescriptionMock();
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const sendSignal = jest.fn(() =>
      Promise.resolve(),
    ) as unknown as jest.MockedFunction<SignalSender>;

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.configureMediaEncryption(ownCall, callKey());
    await manager.ensurePeer('peer-identity-id', false, sendSignal);

    await manager.handleSignal(
      'peer-identity-id',
      'offer',
      {
        mediaEncryption: encryptedMedia,
        sdp: 'encrypted-offer',
        type: 'offer',
      },
      sendSignal,
      'current-identity-id',
    );

    expect(peers[0].setRemoteDescription).toHaveBeenCalled();
    expect(sendSignal).toHaveBeenCalledWith(
      'peer-identity-id',
      'answer',
      expect.objectContaining({ mediaEncryption: encryptedMedia }),
    );
    expect(manager.isMediaEncryptionActiveWith('peer-identity-id')).toBe(true);
  });

  it('stops sending media of a private call this browser fails to encrypt', async () => {
    const peers: FakePeerConnection[] = [];
    const localStream = mediaStreamWithTracks([mediaTrack('audio', 'audio')]);

    installEncodedStreamSupport();
    installScriptTransformSupport().mockImplementation(() => {
      throw new DOMException('Transform in use.', 'InvalidStateError');
    });
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const sendSignal = jest.fn(() =>
      Promise.resolve(),
    ) as unknown as jest.MockedFunction<SignalSender>;

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.configureMediaEncryption(ownCall, callKey());
    manager.setLocalStream(localStream);
    await manager.ensurePeer('peer-identity-id', true, sendSignal);
    manager.setLocalStream(localStream);

    const [sender] = peers[0].senders as unknown as FakeSender[];

    expect(sender.replaceTrack).toHaveBeenCalledWith(null);
    expect(sender.createEncodedStreams).not.toHaveBeenCalled();
    expect(peers[0].addTrack).toHaveBeenCalledTimes(1);
    expect(sendSignal).toHaveBeenCalledWith(
      'peer-identity-id',
      'offer',
      expect.objectContaining({
        mediaEncryption: {
          acceptsEncrypted: false,
          enabled: false,
          version: 2,
        },
      }),
    );
    manager.reset();
  });

  it('stops playing media of a private call this browser fails to decrypt', async () => {
    const peers: FakePeerConnection[] = [];
    const remoteTrack = mediaTrack('remote-audio-track', 'audio');

    installEncodedStreamSupport();
    installMediaStreamMock();
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.configureMediaEncryption(ownCall, callKey());
    await manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );
    registeredPeerEventListener(
      peers[0]!,
      'track',
    )({
      receiver: { track: remoteTrack },
      streams: [mediaStreamWithTracks([remoteTrack])],
      track: remoteTrack,
    } as unknown as Event);

    expect(remoteTrack.stop).toHaveBeenCalled();
    manager.reset();
  });

  it('stops reporting and admitting encrypted media once its worker fails', async () => {
    const peers: FakePeerConnection[] = [];

    installEncodedStreamSupport();
    installScriptTransformSupport();
    installSessionDescriptionMock();
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const sendSignal = jest.fn(() =>
      Promise.resolve(),
    ) as unknown as jest.MockedFunction<SignalSender>;
    const encryptedOffer = {
      mediaEncryption: encryptedMedia,
      sdp: 'encrypted-offer',
      type: 'offer',
    };

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.configureMediaEncryption(ownCall, callKey());
    await manager.ensurePeer('peer-identity-id', false, sendSignal);
    await manager.handleSignal(
      'peer-identity-id',
      'offer',
      encryptedOffer,
      sendSignal,
      'current-identity-id',
    );
    const workerFailed = lastCipherWorker().addEventListener.mock.calls.find(
      ([type]) => type === 'error',
    )?.[1] as EventListener;

    expect(manager.isMediaEncryptionActiveWith('peer-identity-id')).toBe(true);
    workerFailed(new Event('error'));
    await manager.ensurePeer('other-identity-id', false, sendSignal);
    await manager.handleSignal(
      'other-identity-id',
      'offer',
      encryptedOffer,
      sendSignal,
      'current-identity-id',
    );

    expect(manager.isMediaEncryptionActiveWith('peer-identity-id')).toBe(false);
    expect(peers[1].setRemoteDescription).not.toHaveBeenCalled();
    expect(peers[1].close).toHaveBeenCalled();
    manager.reset();
  });

  it('opens a remote screen share as the screen video its peer sealed', async () => {
    const peers: FakePeerConnection[] = [];
    const screenTrack = mediaTrack('remote-screen-track', 'video');
    const receiver = { track: screenTrack, transform: null };

    installEncodedStreamSupport();
    installScriptTransformSupport();
    installSessionDescriptionMock();
    installMediaStreamMock();
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const sendSignal = jest.fn(() =>
      Promise.resolve(),
    ) as unknown as jest.MockedFunction<SignalSender>;

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.configureMediaEncryption(ownCall, callKey());
    await manager.ensurePeer('peer-identity-id', false, sendSignal);
    await manager.handleSignal(
      'peer-identity-id',
      'offer',
      {
        mediaEncryption: encryptedMedia,
        screenTrackIds: ['remote-screen-track'],
        sdp: 'encrypted-offer',
        type: 'offer',
      },
      sendSignal,
      'current-identity-id',
    );
    registeredPeerEventListener(
      peers[0]!,
      'track',
    )({
      receiver,
      streams: [mediaStreamWithTracks([screenTrack])],
      track: screenTrack,
    } as unknown as Event);

    expect(receiver.transform).toEqual({
      senderId: 'peer-identity-id',
      side: 'receive',
      track: 'screen-video',
    });
    manager.reset();
  });

  it('hands the key of a newer epoch to the worker of a private call', () => {
    installEncodedStreamSupport();
    installScriptTransformSupport();
    const manager = callPeerConnectionManager();

    manager.configureMediaEncryption(ownCall, callKey());
    const worker = lastCipherWorker();

    manager.rekeyMediaEncryption(callKey(1));

    expect(worker.postMessage).toHaveBeenLastCalledWith(
      { epoch: 1, key: expect.any(ArrayBuffer), type: 'key' },
      [expect.any(ArrayBuffer)],
    );
    manager.reset();
  });

  it('tells the worker of a private call to forget a peer that leaves', async () => {
    const peers: FakePeerConnection[] = [];

    installEncodedStreamSupport();
    installScriptTransformSupport();
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.configureMediaEncryption(ownCall, callKey());
    await manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );
    manager.retainPeers(new Set());

    expect(lastCipherWorker().postMessage).toHaveBeenCalledWith({
      senderId: 'peer-identity-id',
      type: 'forget',
    });
    manager.reset();
  });

  it('keeps its cipher when handed a call key it cannot read', () => {
    installEncodedStreamSupport();
    installScriptTransformSupport();
    const manager = callPeerConnectionManager();

    manager.configureMediaEncryption(ownCall, callKey());
    const worker = lastCipherWorker();

    expect(() =>
      manager.configureMediaEncryption(ownCall, {
        epoch: 1,
        key: 'not a key!',
      }),
    ).toThrow();
    expect(worker.terminate).not.toHaveBeenCalled();
    manager.reset();

    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('answers a peer of a public call that sends no encryption metadata', async () => {
    const peers: FakePeerConnection[] = [];

    installSessionDescriptionMock();
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const sendSignal = jest.fn(() =>
      Promise.resolve(),
    ) as unknown as jest.MockedFunction<SignalSender>;

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    await manager.ensurePeer('peer-identity-id', false, sendSignal);

    await manager.handleSignal(
      'peer-identity-id',
      'offer',
      { sdp: 'public-offer', type: 'offer' },
      sendSignal,
      'current-identity-id',
    );

    expect(peers[0].setRemoteDescription).toHaveBeenCalled();
    expect(sendSignal).toHaveBeenCalledWith(
      'peer-identity-id',
      'answer',
      expect.anything(),
    );
  });

  it('serializes concurrent peer creation for the same identity', async () => {
    const peers: FakePeerConnection[] = [];
    const configurations: RTCConfiguration[] = [];

    installPeerConnectionMock(peers, configurations);
    const manager = callPeerConnectionManager();
    const rtcConfiguration: RTCConfiguration = {
      iceServers: [
        {
          credential: 'turn-password',
          urls: 'turn:relay.example.test',
          username: 'turn-user',
        },
      ],
      iceTransportPolicy: 'relay',
    };
    let resolveConfiguration!: (configuration: RTCConfiguration) => void;
    const pendingConfiguration = new Promise<RTCConfiguration>((resolve) => {
      resolveConfiguration = resolve;
    });
    const rtcConfigurationProvider = jest
      .fn()
      .mockReturnValue(pendingConfiguration);

    manager.configure(rtcConfigurationProvider);

    const firstEnsurePeer = manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );
    const secondEnsurePeer = manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );

    expect(rtcConfigurationProvider).toHaveBeenCalledTimes(1);
    expect(peers).toHaveLength(0);

    resolveConfiguration(rtcConfiguration);
    await Promise.all([firstEnsurePeer, secondEnsurePeer]);

    expect(peers).toHaveLength(1);
    expect(configurations).toEqual([rtcConfiguration]);
  });

  it('sends one initial offer when concurrent peer ensures target the same identity', async () => {
    const peers: FakePeerConnection[] = [];
    const sentSignals: Array<{ signalType: string }> = [];

    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.setLocalStream(
      mediaStreamWithTracks([mediaTrack('microphone', 'audio')]),
    );

    await Promise.all([
      manager.ensurePeer('peer-identity-id', true, (_recipient, signalType) => {
        sentSignals.push({ signalType });

        return Promise.resolve();
      }),
      manager.ensurePeer('peer-identity-id', true, (_recipient, signalType) => {
        sentSignals.push({ signalType });

        return Promise.resolve();
      }),
    ]);

    const [peer] = peers;

    expect(peers).toHaveLength(1);
    expect(peer.createOffer).toHaveBeenCalledTimes(1);
    expect(sentSignals).toEqual([{ signalType: 'offer' }]);
  });

  it('waits for the designated offerer before negotiating a new peer', async () => {
    const peers: FakePeerConnection[] = [];
    const sentSignals: Array<{ signalType: string }> = [];

    installSessionDescriptionMock();
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.setLocalStream(
      mediaStreamWithTracks([mediaTrack('microphone', 'audio')]),
    );

    await manager.ensurePeer(
      'offerer-identity-id',
      false,
      (_recipient, signalType) => {
        sentSignals.push({ signalType });

        return Promise.resolve();
      },
    );

    const [peer] = peers;
    const negotiationNeeded = registeredPeerEventListener(
      peer,
      'negotiationneeded',
    );

    negotiationNeeded(new Event('negotiationneeded'));
    await Promise.resolve();

    expect(peer.createOffer).not.toHaveBeenCalled();
    expect(sentSignals).toEqual([]);

    await manager.handleSignal(
      'offerer-identity-id',
      'offer',
      {
        sdp: 'remote-offer-sdp',
        type: 'offer',
      },
      (_recipient, signalType) => {
        sentSignals.push({ signalType });

        return Promise.resolve();
      },
      'waiting-identity-id',
    );

    expect(peer.remoteDescription).toMatchObject({ type: 'offer' });
    expect(sentSignals).toEqual([{ signalType: 'answer' }]);
  });

  it('adds screen sharing without replacing the microphone sender', async () => {
    const peers: FakePeerConnection[] = [];

    installMediaStreamMock();
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const microphone = mediaTrack('microphone', 'audio');
    const screen = mediaTrack('screen', 'video', 'detail');

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.setLocalStream(mediaStreamWithTracks([microphone]));

    await manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );

    const [peer] = peers;
    const [microphoneSender] = peer.senders as unknown as FakeSender[];

    manager.setLocalStream(mediaStreamWithTracks([microphone, screen]));

    expect(microphoneSender.replaceTrack).not.toHaveBeenCalled();
    expect(peer.removeTrack).not.toHaveBeenCalled();
    expect(peer.addTrack).toHaveBeenCalledTimes(2);
    expect(peer.addTrack).toHaveBeenLastCalledWith(
      screen,
      expect.objectContaining({
        getTracks: expect.any(Function) as unknown,
      }),
    );
  });

  it('adds screen share audio without replacing the microphone sender', async () => {
    const peers: FakePeerConnection[] = [];

    installMediaStreamMock();
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const microphone = mediaTrack('microphone', 'audio');
    const screen = mediaTrack('screen', 'video', 'detail');
    const screenAudio = mediaTrack('screen-audio', 'audio', 'music');

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.setLocalStream(mediaStreamWithTracks([microphone]));

    await manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );

    const [peer] = peers;
    const [microphoneSender] = peer.senders as unknown as FakeSender[];

    manager.setLocalStream(
      mediaStreamWithTracks([microphone, screen, screenAudio]),
    );

    expect(microphoneSender.replaceTrack).not.toHaveBeenCalled();
    expect(peer.removeTrack).not.toHaveBeenCalled();
    expect(peer.addTrack).toHaveBeenCalledTimes(3);
    expect(peer.addTrack).toHaveBeenLastCalledWith(
      screenAudio,
      expect.objectContaining({
        getTracks: expect.any(Function) as unknown,
      }),
    );
  });

  it('tracks video-only remote streams', async () => {
    const peers: FakePeerConnection[] = [];

    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const videoTrack = mediaTrack('remote-video-track', 'video');
    const videoStream = mediaStreamWithTracks([videoTrack], 'video-stream');

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    await manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );
    registeredPeerEventListener(
      peers[0]!,
      'track',
    )(remoteTrackEvent(videoTrack, [videoStream]) as unknown as Event);

    expect(manager.remoteMediaStreams()['peer-identity-id']).toBe(videoStream);
  });

  it('removes stale peers and their media when they leave', async () => {
    const peers: FakePeerConnection[] = [];

    installMediaStreamMock();
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const remoteTrack = mediaTrack('remote-audio-track', 'audio');
    const remoteStream = mediaStreamWithTracks([remoteTrack]);

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    await manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );
    registeredPeerEventListener(
      peers[0]!,
      'track',
    )(remoteTrackEvent(remoteTrack, [remoteStream]) as unknown as Event);

    manager.retainPeers(new Set());

    expect(peers[0]?.close).toHaveBeenCalledTimes(1);
    expect(manager.remoteMediaStreams()).toEqual({});
    expect(manager.remoteScreenMediaStreams()).toEqual({});
  });
});
