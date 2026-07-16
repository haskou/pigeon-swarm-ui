export type DescriptionSignalPayload = RTCSessionDescriptionInit & {
  mediaEncryption?: {
    acceptsEncrypted: boolean;
    enabled: boolean;
    version: 1;
  };
  screenAudioStreamIds?: string[];
  screenAudioTrackIds?: string[];
  screenStreamIds?: string[];
  screenTrackIds?: string[];
};
