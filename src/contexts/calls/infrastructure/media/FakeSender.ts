export type FakeSender = Pick<RTCRtpSender, 'replaceTrack' | 'track'> & {
  createEncodedStreams?: jest.MockedFunction<
    () => {
      readable: ReadableStream<RTCEncodedAudioFrame | RTCEncodedVideoFrame>;
      writable: WritableStream<RTCEncodedAudioFrame | RTCEncodedVideoFrame>;
    }
  >;
  replaceTrack: jest.MockedFunction<
    (track: MediaStreamTrack | null) => Promise<void>
  >;
};
