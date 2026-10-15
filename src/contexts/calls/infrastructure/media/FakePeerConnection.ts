export type FakePeerConnection = Pick<
  RTCPeerConnection,
  | 'addEventListener'
  | 'addTrack'
  | 'addTransceiver'
  | 'close'
  | 'getReceivers'
  | 'getSenders'
  | 'getConfiguration'
  | 'setConfiguration'
  | 'removeTrack'
  | 'restartIce'
> & {
  addIceCandidate: (
    candidate?: RTCIceCandidate | RTCIceCandidateInit | null,
  ) => Promise<void>;
  connectionState: RTCPeerConnectionState;
  createAnswer: () => Promise<RTCSessionDescriptionInit>;
  createOffer: () => Promise<RTCSessionDescriptionInit>;
  iceConnectionState: RTCIceConnectionState;
  localDescription: RTCSessionDescriptionInit | null;
  receivers: RTCRtpReceiver[];
  remoteDescription: RTCSessionDescriptionInit | null;
  senders: RTCRtpSender[];
  setLocalDescription: (
    description?: RTCSessionDescriptionInit,
  ) => Promise<void>;
  setRemoteDescription: (
    description: RTCSessionDescriptionInit,
  ) => Promise<void>;
  signalingState: RTCSignalingState;
};
