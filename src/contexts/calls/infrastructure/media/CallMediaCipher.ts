/**
 * How this browser encrypts the media of a private call: every sender and
 * receiver of a call goes through it before any media flows.
 */
export type CallMediaCipher = {
  configureReceiver(receiver: RTCRtpReceiver): void;
  configureSender(sender: RTCRtpSender): void;
  dispose(): void;
  peerConfiguration(rtcConfiguration: RTCConfiguration): RTCConfiguration;
};
