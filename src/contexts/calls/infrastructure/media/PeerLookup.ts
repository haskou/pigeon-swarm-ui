export type PeerLookup = (
  peerIdentityId: string,
) => RTCPeerConnection | undefined;
