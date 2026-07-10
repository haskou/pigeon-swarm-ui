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
  localCandidateType?: 'host' | 'prflx' | 'relay' | 'srflx';
  packetsLost?: number;
  protocol?: string;
  relayProtocol?: string;
  relayUrl?: string;
  remoteCandidateType?: 'host' | 'prflx' | 'relay' | 'srflx';
  speaking: boolean;
  transport?: string;
};
