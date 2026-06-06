export type MediaStatsAccumulator = {
  audioLevel?: number;
  bytesReceived?: number;
  codecId?: string;
  connectionPath?: 'direct' | 'relay' | 'unknown';
  jitterMs?: number;
  latencyMs?: number;
  packetsLost?: number;
  transport?: string;
};
