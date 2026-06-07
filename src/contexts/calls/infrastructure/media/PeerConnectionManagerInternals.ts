export type PeerConnectionManagerInternals = {
  handleRemoteTrack(peerIdentityId: string, event: RTCTrackEvent): void;
  remoteAudio: Map<string, HTMLAudioElement>;
  remoteAudioContexts: Map<string, AudioContext>;
  remoteAudioGains: Map<string, GainNode>;
  remoteAudioOutputSources: Map<string, MediaStreamAudioSourceNode>;
  remoteAudioOutputStreams: Map<string, MediaStream>;
  remoteAudioStreams: Map<string, MediaStream>;
  remoteScreenAudioTrackIds: Map<string, Set<string>>;
  remoteScreenStreams: Map<string, MediaStream>;
  remoteScreenStreamIds: Map<string, Set<string>>;
  remoteStreams: Map<string, MediaStream>;
};
