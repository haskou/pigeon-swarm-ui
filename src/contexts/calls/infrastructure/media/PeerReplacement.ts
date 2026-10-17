import type { SignalSender } from './SignalSender';

/**
 * Closes the connection to a peer and opens a fresh one in its place, which
 * is the only way to negotiate again after a rollback: Chromium and WebKit
 * never run the frame transforms of a connection that rolled back.
 */
export type PeerReplacement = (
  peerIdentityId: string,
  sendSignal: SignalSender,
) => Promise<RTCPeerConnection>;
