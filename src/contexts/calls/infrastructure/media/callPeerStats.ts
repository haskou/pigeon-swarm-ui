export type PeerMediaStats = {
  audioLevel?: number;
  bitrateKbps?: number;
  bytesReceived?: number;
  codec?: string;
  connectionPath?: 'direct' | 'relay' | 'unknown';
  connectionState: RTCPeerConnectionState;
  iceState: RTCIceConnectionState;
  jitterMs?: number;
  latencyMs?: number;
  packetsLost?: number;
  speaking: boolean;
  transport?: string;
};

type AudioInboundStats = {
  audioLevel?: number;
  bytesReceived?: number;
  codecId?: string;
  jitterMs?: number;
  packetsLost?: number;
};

type CandidatePairStats = {
  connectionPath?: 'direct' | 'relay' | 'unknown';
  latencyMs?: number;
  transport?: string;
};

type MediaStatsAccumulator = {
  audioLevel?: number;
  bytesReceived?: number;
  codecId?: string;
  connectionPath?: 'direct' | 'relay' | 'unknown';
  jitterMs?: number;
  latencyMs?: number;
  packetsLost?: number;
  transport?: string;
};

type BrowserRtcStats = RTCStats & {
  audioLevel?: unknown;
  bytesReceived?: unknown;
  candidateType?: unknown;
  codecId?: unknown;
  currentRoundTripTime?: unknown;
  jitter?: unknown;
  kind?: unknown;
  localCandidateId?: unknown;
  mimeType?: unknown;
  packetsLost?: unknown;
  protocol?: unknown;
  remoteCandidateId?: unknown;
  state?: unknown;
};

function candidateById(
  reportsById: Map<string, BrowserRtcStats>,
  candidateId: unknown,
): BrowserRtcStats | undefined {
  return typeof candidateId === 'string'
    ? reportsById.get(candidateId)
    : undefined;
}

function candidateProtocol(candidate?: BrowserRtcStats): string | undefined {
  return typeof candidate?.protocol === 'string'
    ? candidate.protocol.toUpperCase()
    : undefined;
}

function candidateType(candidate?: BrowserRtcStats): string | undefined {
  return typeof candidate?.candidateType === 'string'
    ? candidate.candidateType
    : undefined;
}

function codecLabel(codec?: BrowserRtcStats): string | undefined {
  if (typeof codec?.mimeType !== 'string') return undefined;

  return codec.mimeType.replace(/^audio\//, '');
}

function connectionPathFromCandidateTypes(
  localCandidateType?: string,
  remoteCandidateType?: string,
): 'direct' | 'relay' | 'unknown' {
  if (localCandidateType === 'relay' || remoteCandidateType === 'relay') {
    return 'relay';
  }

  return localCandidateType || remoteCandidateType ? 'direct' : 'unknown';
}

function msFromSecondsStat(value: unknown): number | undefined {
  return typeof value === 'number' ? Math.round(value * 1000) : undefined;
}

function numberStat(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function stringStat(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function audioInboundStats(report: RTCStats): AudioInboundStats {
  const stats = report as BrowserRtcStats;

  if (stats.type !== 'inbound-rtp' || stats.kind !== 'audio') return {};

  return {
    audioLevel: numberStat(stats.audioLevel),
    bytesReceived: numberStat(stats.bytesReceived),
    codecId: stringStat(stats.codecId),
    jitterMs: msFromSecondsStat(stats.jitter),
    packetsLost: numberStat(stats.packetsLost),
  };
}

function candidatePairStats(
  report: RTCStats,
  reportsById: Map<string, BrowserRtcStats>,
): CandidatePairStats {
  const stats = report as BrowserRtcStats;

  if (stats.type !== 'candidate-pair' || stats.state !== 'succeeded') {
    return {};
  }

  const localCandidate = candidateById(reportsById, stats.localCandidateId);
  const remoteCandidate = candidateById(reportsById, stats.remoteCandidateId);
  const localCandidateType = candidateType(localCandidate);
  const remoteCandidateType = candidateType(remoteCandidate);

  return {
    connectionPath: connectionPathFromCandidateTypes(
      localCandidateType,
      remoteCandidateType,
    ),
    latencyMs: msFromSecondsStat(stats.currentRoundTripTime),
    transport:
      candidateProtocol(localCandidate) ?? candidateProtocol(remoteCandidate),
  };
}

function mergeAudioInboundStats(
  accumulator: MediaStatsAccumulator,
  inbound: AudioInboundStats,
): MediaStatsAccumulator {
  const audioLevel =
    inbound.audioLevel === undefined
      ? accumulator.audioLevel
      : Math.max(accumulator.audioLevel ?? 0, inbound.audioLevel);

  return {
    ...accumulator,
    audioLevel,
    bytesReceived: inbound.bytesReceived ?? accumulator.bytesReceived,
    codecId: inbound.codecId ?? accumulator.codecId,
    jitterMs: inbound.jitterMs ?? accumulator.jitterMs,
    packetsLost: inbound.packetsLost ?? accumulator.packetsLost,
  };
}

function mergeCandidatePairStats(
  accumulator: MediaStatsAccumulator,
  candidatePair: CandidatePairStats,
): MediaStatsAccumulator {
  return {
    ...accumulator,
    connectionPath: candidatePair.connectionPath ?? accumulator.connectionPath,
    latencyMs: candidatePair.latencyMs ?? accumulator.latencyMs,
    transport: candidatePair.transport ?? accumulator.transport,
  };
}

function definedPeerStats(
  stats: Partial<PeerMediaStats>,
): Partial<PeerMediaStats> {
  return Object.fromEntries(
    Object.entries(stats).filter(([, value]) => value !== undefined),
  ) as Partial<PeerMediaStats>;
}

export async function collectPeerMediaStats(
  peer: RTCPeerConnection,
  bitrateKbps?: number,
): Promise<PeerMediaStats> {
  const reports = await peer.getStats();
  let accumulator: MediaStatsAccumulator = {};
  const reportsById = new Map<string, BrowserRtcStats>();

  reports.forEach((report) => {
    const statsReport = report as BrowserRtcStats;
    const reportId = stringStat(statsReport.id);

    if (reportId) reportsById.set(reportId, statsReport);
  });

  reports.forEach((report) => {
    const statsReport = report as unknown as RTCStats;
    const inbound = audioInboundStats(statsReport);
    const candidatePair = candidatePairStats(statsReport, reportsById);

    accumulator = mergeAudioInboundStats(accumulator, inbound);
    accumulator = mergeCandidatePairStats(accumulator, candidatePair);
  });

  return {
    ...definedPeerStats({
      audioLevel: accumulator.audioLevel,
      bitrateKbps,
      bytesReceived: accumulator.bytesReceived,
      codec: accumulator.codecId
        ? codecLabel(reportsById.get(accumulator.codecId))
        : undefined,
      connectionPath: accumulator.connectionPath,
      jitterMs: accumulator.jitterMs,
      latencyMs: accumulator.latencyMs,
      packetsLost: accumulator.packetsLost,
      transport: accumulator.transport,
    }),
    connectionState: peer.connectionState,
    iceState: peer.iceConnectionState,
    speaking: (accumulator.audioLevel ?? 0) > 0.04,
  };
}
