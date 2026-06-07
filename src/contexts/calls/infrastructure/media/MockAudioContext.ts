export type MockAudioContext = AudioContext & {
  createdGain: GainNode;
  createdSource: MediaStreamAudioSourceNode;
};
