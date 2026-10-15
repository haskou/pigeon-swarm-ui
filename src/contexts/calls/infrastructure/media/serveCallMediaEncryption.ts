import type { CallMediaEncryptionWorkerScope } from './CallMediaEncryptionWorkerScope';
import type { CallMediaKeyMessage } from './CallMediaKeyMessage';

import { CallMediaFrameCodec } from './CallMediaFrameCodec';

function isCallMediaKeyMessage(data: unknown): data is CallMediaKeyMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as CallMediaKeyMessage).key instanceof ArrayBuffer
  );
}

/**
 * Encrypts the frames of every sender and decrypts those of every receiver of
 * one call, inside its dedicated worker. The first call key message wins and
 * is kept only as a non-extractable CryptoKey. Frames wait for it, so none
 * leaves unencrypted; a transform not created to send decrypts, dropping
 * anything the call key does not authenticate.
 */
export function serveCallMediaEncryption(
  scope: CallMediaEncryptionWorkerScope,
): void {
  let keyArrived: (rawKey: ArrayBuffer) => void = () => undefined;
  const codec = new CallMediaFrameCodec(
    new Promise<ArrayBuffer>((resolve) => {
      keyArrived = resolve;
    }).then(CallMediaFrameCodec.importKey),
  );

  // eslint-disable-next-line no-param-reassign -- a worker serves its scope
  scope.onmessage = ({ data }): void => {
    if (isCallMediaKeyMessage(data)) keyArrived(data.key);
  };
  // eslint-disable-next-line no-param-reassign -- a worker serves its scope
  scope.onrtctransform = ({ transformer }): void => {
    const sends =
      (transformer.options as { side?: unknown } | null)?.side === 'send';

    void transformer.readable
      .pipeThrough(sends ? codec.senderTransform() : codec.receiverTransform())
      .pipeTo(transformer.writable)
      .catch(() => undefined);
  };
}
