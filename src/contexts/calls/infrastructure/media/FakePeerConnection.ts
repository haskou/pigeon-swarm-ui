export type FakePeerConnection = Pick<
  RTCPeerConnection,
  | 'addEventListener'
  | 'addTrack'
  | 'addTransceiver'
  | 'close'
  | 'getSenders'
  | 'removeTrack'
> & {
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  localDescription: RTCSessionDescriptionInit | null;
  senders: RTCRtpSender[];
  signalingState: RTCSignalingState;
};
