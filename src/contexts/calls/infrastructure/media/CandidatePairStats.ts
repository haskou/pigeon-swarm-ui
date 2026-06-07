export type CandidatePairStats = {
  connectionPath?: 'direct' | 'relay' | 'unknown';
  latencyMs?: number;
  transport?: string;
};
