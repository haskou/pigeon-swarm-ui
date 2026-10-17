export type PeerNegotiationState = {
  ignoreOffer: boolean;
  makingOffer: boolean;
  polite: boolean;
  /**
   * Fingerprints of the remote connections replaced since; whatever they
   * still send is stale.
   */
  retiredFingerprints: string[];
};
