export type DescriptionSignalPayload = RTCSessionDescriptionInit & {
  screenAudioStreamIds?: string[];
  screenAudioTrackIds?: string[];
  screenStreamIds?: string[];
  screenTrackIds?: string[];
};
