export type MediaStatsAccumulator = {
  audioLevel?: number;
  bytesReceived?: number;
  codecId?: string;
  connectionPath?: 'direct' | 'relay' | 'unknown';
  jitterMs?: number;
  latencyMs?: number;
  localCandidateType?: 'host' | 'prflx' | 'relay' | 'srflx';
  packetsLost?: number;
  protocol?: string;
  relayProtocol?: string;
  relayUrl?: string;
  remoteCandidateType?: 'host' | 'prflx' | 'relay' | 'srflx';
  transport?: string;
};
