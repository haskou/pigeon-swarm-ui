export type CandidatePairStats = {
  connectionPath?: 'direct' | 'relay' | 'unknown';
  latencyMs?: number;
  localCandidateType?: 'host' | 'prflx' | 'relay' | 'srflx';
  protocol?: string;
  relayProtocol?: string;
  relayUrl?: string;
  remoteCandidateType?: 'host' | 'prflx' | 'relay' | 'srflx';
  transport?: string;
};
