import type { EncodedCallMediaFrame } from './EncodedCallMediaFrame';

/**
 * What a worker receives for each RTCRtpScriptTransform: the encoded frames of
 * one sender or receiver and the options the transform was created with. The
 * DOM library declares it only for worker scopes.
 */
export type CallMediaScriptTransformer = {
  readonly options: unknown;
  readonly readable: ReadableStream<EncodedCallMediaFrame>;
  readonly writable: WritableStream<EncodedCallMediaFrame>;
};
