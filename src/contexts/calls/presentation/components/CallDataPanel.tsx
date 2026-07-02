import type { CallSession } from '../../domain/callSession.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { JsonDataViewer } from '../../../../shared/presentation/components/JsonDataViewer';

export function CallDataPanel({ call }: { call: CallSession }) {
  const data = {
    serverCall: call.call ?? null,
    derivedFrontend: {
      cameraEnabled: call.cameraEnabled,
      channelId: call.channelId,
      communityId: call.communityId,
      conversationId: call.conversationId,
      hasMicrophone: call.hasMicrophone,
      kind: call.kind,
      mediaEncryption: call.mediaEncryption,
      screenSharing: call.screenSharing,
      screenShareQuality: call.screenShareQuality,
      status: call.status,
      subtitle: call.subtitle,
      title: call.title,
    },
    derivedParticipants: call.participants.map((participant) => ({
      audioLevel: participant.audioLevel,
      bitrateKbps: participant.bitrateKbps,
      codec: participant.codec,
      connectionPath: participant.connectionPath,
      connectionState: participant.connectionState,
      connected: participant.connected,
      identityId: participant.identityId,
      iceState: participant.iceState,
      jitterMs: participant.jitterMs,
      lastHeartbeatAt: participant.lastHeartbeatAt,
      latencyMs: participant.latencyMs,
      muted: participant.muted,
      name: participant.name,
      packetsLost: participant.packetsLost,
      screenSharing: participant.screenSharing,
      speaking: participant.speaking,
      status: participant.status,
      transport: participant.transport,
      videoEnabled: participant.videoEnabled,
    })),
  };

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden border-t border-white/10 pt-4">
      <h3 className="mb-3 text-sm font-black text-white/80">
        {copy.calls.callData}
      </h3>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <JsonDataViewer data={data} />
      </div>
    </aside>
  );
}
