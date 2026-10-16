import type { CallMediaKey } from './CallMediaKey';
import type { CallMediaTrack } from './CallMediaTrack';

/**
 * How this browser encrypts the media of a private call: every sender and
 * receiver of a call goes through it before any media flows, bound to the
 * track it carries. Once it cannot encrypt one of them, or loses its worker,
 * it has failed for good and takes no other.
 */
export type CallMediaCipher = {
  readonly failed: boolean;
  /**
   * Whether `receiver` plays only media of `senderId` on `track` opened here.
   * A receiver it already took moves to `track`.
   */
  configureReceiver(
    receiver: RTCRtpReceiver,
    senderId: string,
    track: CallMediaTrack,
  ): boolean;
  /**
   * Whether `sender` sends only media sealed here for `track`. A sender it
   * already took moves to `track`.
   */
  configureSender(sender: RTCRtpSender, track: CallMediaTrack): boolean;
  dispose(): void;
  /** Drops what opens the media of `senderId`, who left the call. */
  forget(senderId: string): void;
  peerConfiguration(rtcConfiguration: RTCConfiguration): RTCConfiguration;
  /** Seals with `key` from now on and opens it too, if its epoch is newer. */
  rekey(key: CallMediaKey): void;
};
