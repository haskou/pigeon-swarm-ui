import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { CompactCallBar } from '../../src/contexts/calls/presentation/components/CompactCallBar';
import { requestCallMicrophone } from '../../src/contexts/calls/presentation/hooks/requestCallMicrophone';
import { useCallSession } from '../../src/contexts/calls/presentation/hooks/useCallSession';
import type { CallSessionControls } from '../../src/contexts/calls/presentation/hooks/CallSessionControls';
import type { CallResource } from '../../src/contexts/calls/infrastructure/http/resources/CallResource';
import type { CallSignalType } from '../../src/contexts/calls/infrastructure/media/CallSignalType';
import type { CallSession } from '../../src/contexts/calls/presentation/view-models/CallSession';

// Renders the production call session hook so microphone, network-change and
// realtime-reconnect handling run exactly as in the workspace.
const params = new URLSearchParams(location.search);
const identity = params.get('identity') ?? 'alice';
const remote = identity === 'alice' ? 'bob' : 'alice';
// A private call has a media key, the conversation key in epoch 0; without
// one the call is public.
const mediaKey = params.get('mediaKey');
const mediaEncryptionKey = mediaKey ? { epoch: 0, key: mediaKey } : undefined;
const callId = 'private-call-id';
const nativePeers: RTCPeerConnection[] = [];
const NativePeerConnection = window.RTCPeerConnection;
window.RTCPeerConnection = class extends NativePeerConnection {
  constructor(configuration?: RTCConfiguration) {
    super(configuration);
    nativePeers.push(this);
  }
};
let backendAvailable = true;
let configurationRequests = 0;
const callResource: CallResource = {
  createdAt: Date.now(),
  creatorIdentityId: 'alice',
  id: callId,
  networkId: 'network-1',
  participantIds: ['alice', 'bob'],
  participants: ['alice', 'bob'].map((identityId) => ({
    connected: true,
    identityId,
    joinedAt: Date.now(),
    status: 'joined' as const,
  })),
  scope: { conversationId: 'one-to-one:alice:bob', type: 'conversation' },
  status: 'active',
};
let session: CallSessionControls | null = null;

function App() {
  const current = useCallSession();

  useEffect(() => {
    session = current;
  });

  const call = current.activeCall;

  if (!call) return null;

  return (
    <main style={{ maxWidth: 480, background: '#151722', padding: 16 }}>
      <CompactCallBar
        call={call}
        subtitle="Call"
        onEnd={current.endCall}
        onOpenStage={() => undefined}
        onRetryConnection={current.retryConnection}
        onRetryMicrophone={(deviceId) => void current.retryMicrophone(deviceId)}
        onToggleCamera={() => void current.toggleCamera()}
        onToggleDeafen={current.toggleDeafen}
        onToggleMute={current.toggleMute}
        onToggleNoiseCancellation={() => undefined}
        onToggleScreenShare={() => void current.toggleScreenShare()}
      />
    </main>
  );
}

async function audioStats(peer: RTCPeerConnection) {
  let energy = 0;
  let received = 0;
  let sent = 0;

  (await peer.getStats()).forEach((report) => {
    if (report.kind !== 'audio') return;
    if (report.type === 'inbound-rtp') {
      received += report.bytesReceived ?? 0;
      // Energy of the decoded audio: only frames that decrypted reach it.
      energy += report.totalAudioEnergy ?? 0;
    }
    if (report.type === 'outbound-rtp') sent += report.bytesSent ?? 0;
  });

  return { energy, received, sent };
}

function transformName(endpoint: RTCRtpReceiver | RTCRtpSender | undefined) {
  return endpoint?.transform?.constructor.name ?? null;
}

// The transforms the browser runs on the audio this peer sends and receives.
function audioTransforms(peer: RTCPeerConnection) {
  return {
    receiver: transformName(
      peer.getReceivers().find(({ track }) => track.kind === 'audio'),
    ),
    sender: transformName(
      peer.getSenders().find(({ track }) => track?.kind === 'audio'),
    ),
  };
}

function activeSession(): CallSessionControls {
  if (!session) throw new Error('Call session is not mounted');

  return session;
}

createRoot(document.getElementById('root')!).render(<App />);

window.callSessionTest = {
  start: async () => {
    // Mirrors the workspace: request the microphone first, then join the call
    // with whatever the browser granted.
    const microphone = await requestCallMicrophone({
      noiseCancellationEnabled: false,
    });

    await activeSession().startCall({
      call: callResource,
      currentIdentityId: identity,
      id: callId,
      kind: 'one-to-one',
      loadIceConfig: async () => {
        configurationRequests++;

        if (!backendAvailable) throw new Error('Backend unavailable');

        return { iceServers: [] };
      },
      localStream: microphone.stream,
      mediaEncryptionKey,
      mediaEncryptionUnavailableReason: 'missing-key',
      microphoneError: microphone.microphoneError,
      noiseCancellationEnabled: false,
      onSignal: async (_recipient, type, payload) => {
        if (!backendAvailable) throw new Error('Backend unavailable');

        await window.sendTestSignal(type, payload);
      },
      participants: [identity, remote].map((identityId) => ({
        identityId,
        muted: false,
        name: 'Private name',
      })),
      title: 'Private title',
    });
  },
  receive: async (type, payload) =>
    activeSession().receiveSignal({
      callId,
      payload,
      senderIdentityId: remote,
      signalType: type,
    }),
  setBackendAvailable: (available) => {
    backendAvailable = available;
  },
  // What the workspace runs when its realtime socket reconnects.
  recoverRealtime: () => activeSession().recoverAfterDisruption(),
  inspect: async () => {
    const call = activeSession().activeCall;
    const open = nativePeers.filter(
      (peer) => peer.connectionState !== 'closed',
    );

    return {
      call: call
        ? {
            // Peers whose media this side encrypts and decrypts.
            encryptedWith: call.participants
              .filter(
                (participant) =>
                  participant.identityId !== identity &&
                  participant.mediaEncryptionActive,
              )
              .map((participant) => participant.identityId),
            hasMicrophone: call.hasMicrophone,
            mediaEncryption: call.mediaEncryption,
            microphoneError: call.microphoneError,
            // Join order differs per side; identity is what must not repeat.
            participantIds: call.participants
              .map((participant) => participant.identityId)
              .sort(),
            status: call.status,
          }
        : null,
      configurationRequests,
      nativePeers: nativePeers.length,
      peers: await Promise.all(
        open.map(async (peer) => ({
          ...(await audioStats(peer)),
          audioTransforms: audioTransforms(peer),
          connectionState: peer.connectionState,
          iceUfrag:
            peer.localDescription?.sdp.match(/^a=ice-ufrag:(\S+)/m)?.[1] ??
            null,
        })),
      ),
      audioElements: document.querySelectorAll('audio').length,
      remoteConnections: activeSession()
        .callMediaConnections()
        .map((connection) => connection.remoteIdentityId),
    };
  },
};

declare global {
  interface Window {
    sendTestSignal: (
      type: CallSignalType,
      payload: Record<string, unknown>,
    ) => Promise<void>;
    callSessionTest: {
      start: () => Promise<void>;
      receive: (
        type: CallSignalType,
        payload: Record<string, unknown>,
      ) => Promise<void>;
      setBackendAvailable: (available: boolean) => void;
      recoverRealtime: () => void;
      inspect: () => Promise<{
        call: {
          encryptedWith: string[];
          hasMicrophone: boolean;
          mediaEncryption: CallSession['mediaEncryption'];
          microphoneError: CallSession['microphoneError'];
          participantIds: string[];
          status: CallSession['status'];
        } | null;
        configurationRequests: number;
        nativePeers: number;
        peers: Array<{
          audioTransforms: {
            receiver: string | null;
            sender: string | null;
          };
          connectionState: RTCPeerConnectionState;
          energy: number;
          iceUfrag: string | null;
          received: number;
          sent: number;
        }>;
        audioElements: number;
        remoteConnections: string[];
      }>;
    };
  }
}
