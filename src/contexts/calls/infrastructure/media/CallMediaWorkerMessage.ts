/**
 * What the page tells the call media encryption worker: the call and this
 * identity first, then the call key of each epoch as raw bytes, and the
 * senders that left the call.
 */
export type CallMediaWorkerMessage =
  | {
      readonly callId: string;
      readonly senderId: string;
      readonly type: 'call';
    }
  | { readonly epoch: number; readonly key: ArrayBuffer; readonly type: 'key' }
  | { readonly senderId: string; readonly type: 'forget' };
