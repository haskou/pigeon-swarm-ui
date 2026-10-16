export type DescriptionSignalPayload = RTCSessionDescriptionInit & {
  mediaEncryption?: {
    acceptsEncrypted: boolean;
    enabled: boolean;
    version: 2;
  };
  screenAudioStreamIds?: string[];
  screenAudioTrackIds?: string[];
  screenStreamIds?: string[];
  screenTrackIds?: string[];
};
