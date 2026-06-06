export type FakeSender = Pick<RTCRtpSender, 'replaceTrack' | 'track'> & {
  replaceTrack: jest.MockedFunction<
    (track: MediaStreamTrack | null) => Promise<void>
  >;
};
