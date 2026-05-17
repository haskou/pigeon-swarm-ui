import type { CallSession } from '../../domain/calls/CallSession';

export function CallDataPanel({ call }: { call: CallSession }) {
  const data = {
    call: call.call ?? null,
    frontend: {
      cameraEnabled: call.cameraEnabled,
      channelId: call.channelId,
      communityId: call.communityId,
      conversationId: call.conversationId,
      hasMicrophone: call.hasMicrophone,
      kind: call.kind,
      screenSharing: call.screenSharing,
      status: call.status,
      subtitle: call.subtitle,
      title: call.title,
    },
    participants: call.participants.map((participant) => ({
      audioLevel: participant.audioLevel,
      connectionState: participant.connectionState,
      identityId: participant.identityId,
      latencyMs: participant.latencyMs,
      muted: participant.muted,
      name: participant.name,
      packetsLost: participant.packetsLost,
      screenSharing: participant.screenSharing,
      speaking: participant.speaking,
      status: participant.status,
      videoEnabled: participant.videoEnabled,
    })),
  };

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-[1.5rem] border border-white/10 bg-black/25 p-4">
      <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white/40">
        Call data
      </h3>
      <pre className="mt-3 min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-black/35 p-3 text-xs leading-relaxed text-white/70">
        {JSON.stringify(data, null, 2)}
      </pre>
    </aside>
  );
}
