import type { CallMediaTrack } from './CallMediaTrack';

/**
 * The options of a call media RTCRtpScriptTransform: whether it seals the
 * frames of a sender or opens those of a receiver, whose frames they are and
 * which track they belong to.
 */
export type CallMediaTransformOptions = {
  readonly senderId: string;
  readonly side: 'receive' | 'send';
  readonly track: CallMediaTrack;
};
