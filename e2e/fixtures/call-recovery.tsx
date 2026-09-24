import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { CallPeerConnections } from '../../src/contexts/calls/infrastructure/media/CallPeerConnections';
import { RemoteCallAudio } from '../../src/contexts/calls/infrastructure/media/RemoteCallAudio';
import { BrowserRemoteAudioElementHost } from '../../src/contexts/calls/infrastructure/media/BrowserRemoteAudioElementHost';
import { CompactCallBar } from '../../src/contexts/calls/presentation/components/CompactCallBar';
import { CallDataPanel } from '../../src/contexts/calls/presentation/components/CallDataPanel';
import { participantsWithMediaState } from '../../src/contexts/calls/presentation/hooks/callSessionMediaState';
import type { CallSession } from '../../src/contexts/calls/presentation/view-models/CallSession';
import type { CallSignalType } from '../../src/contexts/calls/infrastructure/media/CallSignalType';

const identity =
  new URLSearchParams(location.search).get('identity') ?? 'alice';
const remote = identity === 'alice' ? 'bob' : 'alice';
const root = createRoot(document.getElementById('root')!);
const nativePeers: RTCPeerConnection[] = [];
const NativePeerConnection = window.RTCPeerConnection;
window.RTCPeerConnection = class extends NativePeerConnection {
  constructor(configuration?: RTCConfiguration) {
    super(configuration);
    nativePeers.push(this);
  }
};
const manager = new CallPeerConnections(
  new RemoteCallAudio(new BrowserRemoteAudioElementHost()),
);
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
let configurationRequests = 0;
let stageOpens = 0;
let disposed = false;
let call: CallSession = {
  id: 'private-call-id',
  currentIdentityId: identity,
  title: 'Private title',
  kind: 'one-to-one',
  status: 'live',
  startedAt: Date.now(),
  cameraEnabled: false,
  deafened: false,
  hasMicrophone: true,
  muted: false,
  noiseCancellationEnabled: false,
  screenSharing: false,
  screenShareAudioEnabled: true,
  screenShareQuality: 'auto',
  screenShareVolumes: {},
  participantVolumes: {},
  mediaEncryption: {
    active: false,
    available: false,
    enabled: false,
    reason: 'missing-key',
  },
  participants: [identity, remote].map((identityId) => ({
    identityId,
    name: 'Private name',
    muted: false,
  })),
};
const noop = () => undefined;
const retry = () => manager.retryConnections();
const render = () =>
  root.render(
    <main style={{ maxWidth: 480, background: '#151722', padding: 16 }}>
      <CompactCallBar
        call={call}
        subtitle="Call"
        onEnd={dispose}
        onOpenStage={() => stageOpens++}
        onRetryConnection={retry}
        onRetryMicrophone={noop}
        onToggleCamera={noop}
        onToggleDeafen={noop}
        onToggleMute={noop}
        onToggleNoiseCancellation={noop}
        onToggleScreenShare={noop}
      />
      <CallDataPanel call={call} />
    </main>,
  );
manager.configure(async () => {
  configurationRequests++;
  return { iceServers: [] };
});
manager.setLocalStream(stream);
const send = async (
  _recipient: string,
  type: CallSignalType,
  payload: Record<string, unknown>,
) => {
  await window.sendTestSignal(type, payload);
};
const timer = setInterval(async () => {
  const stats = await manager.collectStats();
  if (disposed) return;
  call = {
    ...call,
    participants: participantsWithMediaState(
      call,
      stats,
      {},
      {},
      0,
      () => false,
    ),
  };
  render();
}, 250);
function dispose() {
  disposed = true;
  clearInterval(timer);
  manager.reset();
  stream.getTracks().forEach((track) => track.stop());
  root.unmount();
}
window.callRecoveryTest = {
  start: async (offer: boolean) => {
    await manager.ensurePeer(remote, offer, send);
  },
  receive: async (type: CallSignalType, payload: Record<string, unknown>) =>
    manager.handleSignal(remote, type, payload, send, identity),
  restart: () => nativePeers.forEach((peer) => peer.restartIce()),
  inspect: async () => ({
    stats: await manager.collectStats(),
    native: nativePeers.map((peer) => ({
      signalingState: peer.signalingState,
      hasDescriptions: Boolean(peer.localDescription && peer.remoteDescription),
    })),
    configurationRequests,
    stageOpens,
    audioElements: document.querySelectorAll('audio').length,
  }),
  dispose,
};
render();

declare global {
  interface Window {
    sendTestSignal: (
      type: CallSignalType,
      payload: Record<string, unknown>,
    ) => Promise<void>;
    callRecoveryTest: {
      start: (offer: boolean) => Promise<void>;
      receive: (
        type: CallSignalType,
        payload: Record<string, unknown>,
      ) => Promise<void>;
      inspect: () => Promise<{
        stats: Awaited<ReturnType<CallPeerConnections['collectStats']>>;
        native: Array<{
          signalingState: RTCSignalingState;
          hasDescriptions: boolean;
        }>;
        configurationRequests: number;
        stageOpens: number;
        audioElements: number;
      }>;
      dispose: () => void;
      restart: () => void;
    };
  }
}
