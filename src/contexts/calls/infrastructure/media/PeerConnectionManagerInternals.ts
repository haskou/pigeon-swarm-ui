export type PeerConnectionManagerInternals = {
  handleRemoteTrack(peerIdentityId: string, event: RTCTrackEvent): void;
  remoteScreenAudioTrackIds: Map<string, Set<string>>;
  remoteScreenStreams: Map<string, MediaStream>;
  remoteScreenStreamIds: Map<string, Set<string>>;
  remoteStreams: Map<string, MediaStream>;
};
