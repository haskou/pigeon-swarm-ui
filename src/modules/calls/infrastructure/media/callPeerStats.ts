export type PeerMediaStats = {
  audioLevel?: number;
  connectionState: RTCPeerConnectionState;
  latencyMs?: number;
  packetsLost?: number;
  speaking: boolean;
};

type AudioInboundStats = {
  audioLevel?: number;
  packetsLost?: number;
};

type CandidatePairStats = {
  latencyMs?: number;
};

type BrowserRtcStats = RTCStats & {
  audioLevel?: unknown;
  currentRoundTripTime?: unknown;
  kind?: unknown;
  packetsLost?: unknown;
  state?: unknown;
};

function audioInboundStats(report: RTCStats): AudioInboundStats {
  const stats = report as BrowserRtcStats;

  if (stats.type !== 'inbound-rtp' || stats.kind !== 'audio') return {};

  return {
    audioLevel:
      typeof stats.audioLevel === 'number' ? stats.audioLevel : undefined,
    packetsLost:
      typeof stats.packetsLost === 'number' ? stats.packetsLost : undefined,
  };
}

function candidatePairStats(report: RTCStats): CandidatePairStats {
  const stats = report as BrowserRtcStats;

  if (
    stats.type !== 'candidate-pair' ||
    stats.state !== 'succeeded' ||
    typeof stats.currentRoundTripTime !== 'number'
  ) {
    return {};
  }

  return {
    latencyMs: Math.round(stats.currentRoundTripTime * 1000),
  };
}

export async function collectPeerMediaStats(
  peer: RTCPeerConnection,
): Promise<PeerMediaStats> {
  const reports = await peer.getStats();
  let audioLevel: number | undefined;
  let latencyMs: number | undefined;
  let packetsLost: number | undefined;

  reports.forEach((report) => {
    const statsReport = report as unknown as RTCStats;
    const inbound = audioInboundStats(statsReport);
    const candidatePair = candidatePairStats(statsReport);

    if (inbound.audioLevel !== undefined) {
      audioLevel = Math.max(audioLevel ?? 0, inbound.audioLevel);
    }

    if (inbound.packetsLost !== undefined) packetsLost = inbound.packetsLost;

    if (candidatePair.latencyMs !== undefined) {
      latencyMs = candidatePair.latencyMs;
    }
  });

  return {
    audioLevel,
    connectionState: peer.connectionState,
    latencyMs,
    packetsLost,
    speaking: (audioLevel ?? 0) > 0.04,
  };
}
