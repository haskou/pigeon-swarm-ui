import type { EncodedCallMediaFrameStreams } from './EncodedCallMediaFrameStreams';

export type EncodedCallMediaStreamOwner = {
  createEncodedStreams?: () => EncodedCallMediaFrameStreams;
};
