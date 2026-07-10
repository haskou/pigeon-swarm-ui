export type CallParticipantMediaConnection = {
  localCandidateType?: 'host' | 'prflx' | 'relay' | 'srflx';
  protocol?: string;
  relayProtocol?: string;
  relayUrl?: string;
  remoteCandidateType?: 'host' | 'prflx' | 'relay' | 'srflx';
  remoteIdentityId: string;
  state: RTCPeerConnectionState;
  usesRelay?: boolean;
};
