const fingerprintLine = /^a=fingerprint:([^\r\n]+)$/m;

/**
 * The DTLS certificate fingerprint a description announces. Every connection
 * has a certificate of its own, so it tells the connections of a peer apart
 * and stays the same across all descriptions one connection sends.
 */
export function descriptionFingerprint(
  description: RTCSessionDescriptionInit | null | undefined,
): string | undefined {
  return description?.sdp?.match(fingerprintLine)?.[1].trim().toLowerCase();
}
