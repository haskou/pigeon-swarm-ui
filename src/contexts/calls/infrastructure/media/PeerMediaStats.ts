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
