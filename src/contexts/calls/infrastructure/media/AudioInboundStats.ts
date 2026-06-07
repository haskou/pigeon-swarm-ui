export type AudioInboundStats = {
  audioLevel?: number;
  bytesReceived?: number;
  codecId?: string;
  jitterMs?: number;
  packetsLost?: number;
};
