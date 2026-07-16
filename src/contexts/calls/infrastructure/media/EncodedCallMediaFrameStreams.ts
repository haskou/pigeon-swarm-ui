import type { EncodedCallMediaFrame } from './EncodedCallMediaFrame';

export type EncodedCallMediaFrameStreams = {
  readable: ReadableStream<EncodedCallMediaFrame>;
  writable: WritableStream<EncodedCallMediaFrame>;
};
