import type { CallMediaEncryptionWorkerScope } from './CallMediaEncryptionWorkerScope';
import type { CallMediaWorkerMessage } from './CallMediaWorkerMessage';

import { CallMediaFrameCodec } from './CallMediaFrameCodec';
import { callMediaTransformOptionsOf } from './callMediaTrackOf';

function isWorkerMessage(data: unknown): data is CallMediaWorkerMessage {
  if (typeof data !== 'object' || data === null) return false;

  const message = data as Record<string, unknown>;

  switch (message.type) {
    case 'call':
      return (
        typeof message.callId === 'string' &&
        typeof message.senderId === 'string'
      );
    case 'forget':
      return typeof message.senderId === 'string';
    case 'key':
      return (
        message.key instanceof ArrayBuffer && typeof message.epoch === 'number'
      );
    default:
      return false;
  }
}

/** Passes nothing: the frames of a transform this worker cannot serve. */
function droppingTransform<Frame>(): TransformStream<Frame, Frame> {
  return new TransformStream<Frame, Frame>({ transform: () => undefined });
}

/**
 * Seals the frames of every sender and opens those of every receiver of one
 * call, inside its dedicated worker. The first call message names the call
 * and this identity; each key message hands over the raw call key of an
 * epoch, which the worker keeps only until a newer epoch replaces it. Frames
 * wait for the call and its first key, so none leaves unsealed; a transform
 * with options it does not understand passes nothing.
 */
export function serveCallMediaEncryption(
  scope: CallMediaEncryptionWorkerScope,
): void {
  let codec: CallMediaFrameCodec | null = null;
  let callArrived: (codec: CallMediaFrameCodec) => void = () => undefined;
  const call = new Promise<CallMediaFrameCodec>((resolve) => {
    callArrived = resolve;
  });

  // eslint-disable-next-line no-param-reassign -- a worker serves its scope
  scope.onmessage = ({ data }): void => {
    if (!isWorkerMessage(data)) return;

    if (data.type === 'call') {
      if (codec) return;

      codec = new CallMediaFrameCodec({
        callId: data.callId,
        senderId: data.senderId,
      });
      callArrived(codec);
    } else if (data.type === 'key') {
      const key = new Uint8Array(data.key);

      if (codec) codec.addKey(key, data.epoch);
      else key.fill(0);
    } else {
      codec?.forget(data.senderId);
    }
  };
  // eslint-disable-next-line no-param-reassign -- a worker serves its scope
  scope.onrtctransform = ({ transformer }): void => {
    const options = callMediaTransformOptionsOf(transformer.options);

    void call
      .then((served) => {
        if (!options) return droppingTransform();

        const track = (): typeof options.track => options.track;

        return options.side === 'send'
          ? served.senderTransform(track)
          : served.receiverTransform(options.senderId, track);
      })
      .then((transform) =>
        transformer.readable
          .pipeThrough(transform)
          .pipeTo(transformer.writable),
      )
      .catch(() => undefined);
  };
}
