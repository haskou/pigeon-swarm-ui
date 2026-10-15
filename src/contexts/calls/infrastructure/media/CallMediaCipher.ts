/**
 * How this browser encrypts the media of a private call: every sender and
 * receiver of a call goes through it before any media flows. Once it cannot
 * encrypt one of them, or loses its worker, it has failed for good and takes
 * no other.
 */
export type CallMediaCipher = {
  readonly failed: boolean;
  /** Whether `receiver` plays only media decrypted here. */
  configureReceiver(receiver: RTCRtpReceiver): boolean;
  /** Whether `sender` sends only media encrypted here. */
  configureSender(sender: RTCRtpSender): boolean;
  dispose(): void;
  peerConfiguration(rtcConfiguration: RTCConfiguration): RTCConfiguration;
};
