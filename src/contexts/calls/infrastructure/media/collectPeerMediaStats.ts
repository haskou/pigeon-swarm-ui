import type { AudioInboundStats } from './AudioInboundStats';
import type { BrowserRtcStats } from './BrowserRtcStats';
import type { CandidatePairStats } from './CandidatePairStats';
import type { MediaStatsAccumulator } from './MediaStatsAccumulator';
import type { PeerMediaStats } from './PeerMediaStats';

export type { PeerMediaStats } from './PeerMediaStats';

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
    ? candidate.protocol.toLowerCase()
    : undefined;
}

function candidateType(
  candidate?: BrowserRtcStats,
): 'host' | 'prflx' | 'relay' | 'srflx' | undefined {
  const value = candidate?.candidateType;

  return value === 'host' ||
    value === 'prflx' ||
    value === 'relay' ||
    value === 'srflx'
    ? value
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
  report: BrowserRtcStats | undefined,
  reportsById: Map<string, BrowserRtcStats>,
): CandidatePairStats {
  if (!report || report.type !== 'candidate-pair') {
    return {};
  }

  const localCandidate = candidateById(reportsById, report.localCandidateId);
  const remoteCandidate = candidateById(reportsById, report.remoteCandidateId);
  const localCandidateType = candidateType(localCandidate);
  const remoteCandidateType = candidateType(remoteCandidate);
  const protocol =
    candidateProtocol(localCandidate) ?? candidateProtocol(remoteCandidate);

  return {
    connectionPath: connectionPathFromCandidateTypes(
      localCandidateType,
      remoteCandidateType,
    ),
    latencyMs: msFromSecondsStat(report.currentRoundTripTime),
    localCandidateType,
    protocol,
    relayProtocol: stringStat(localCandidate?.relayProtocol)?.toLowerCase(),
    relayUrl: stringStat(localCandidate?.url),
    remoteCandidateType,
    transport: protocol,
  };
}

function selectedCandidatePair(
  reports: BrowserRtcStats[],
  reportsById: Map<string, BrowserRtcStats>,
): BrowserRtcStats | undefined {
  const transport = reports.find(
    (report) =>
      report.type === 'transport' &&
      typeof report.selectedCandidatePairId === 'string',
  );
  const selectedId = stringStat(transport?.selectedCandidatePairId);

  if (selectedId) return reportsById.get(selectedId);

  return (
    reports.find(
      (report) =>
        report.type === 'candidate-pair' &&
        report.state === 'succeeded' &&
        report.nominated === true,
    ) ??
    reports.find(
      (report) =>
        report.type === 'candidate-pair' && report.state === 'succeeded',
    )
  );
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
  const definedCandidatePair = Object.fromEntries(
    Object.entries(candidatePair).filter(([, value]) => value !== undefined),
  ) as CandidatePairStats;

  return {
    ...accumulator,
    ...definedCandidatePair,
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
  const browserReports: BrowserRtcStats[] = [];

  reports.forEach((report) => {
    const statsReport = report as BrowserRtcStats;
    const reportId = stringStat(statsReport.id);

    browserReports.push(statsReport);

    if (reportId) reportsById.set(reportId, statsReport);
  });

  reports.forEach((report) => {
    const statsReport = report as unknown as RTCStats;
    const inbound = audioInboundStats(statsReport);

    accumulator = mergeAudioInboundStats(accumulator, inbound);
  });

  accumulator = mergeCandidatePairStats(
    accumulator,
    candidatePairStats(
      selectedCandidatePair(browserReports, reportsById),
      reportsById,
    ),
  );

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
      localCandidateType: accumulator.localCandidateType,
      packetsLost: accumulator.packetsLost,
      protocol: accumulator.protocol,
      relayProtocol: accumulator.relayProtocol,
      relayUrl: accumulator.relayUrl,
      remoteCandidateType: accumulator.remoteCandidateType,
      transport: accumulator.transport,
    }),
    connectionState: peer.connectionState,
    iceState: peer.iceConnectionState,
    speaking: (accumulator.audioLevel ?? 0) > 0.04,
  };
}
