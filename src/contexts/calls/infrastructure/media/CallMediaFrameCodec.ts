import {
  CallMediaFrameCipher,
  SymmetricKey,
} from '@haskou/pigeon-swarm-crypto';
import { Buffer } from 'buffer';

import type { EncodedCallMediaFrame } from './EncodedCallMediaFrame';

/**
 * Pipes the encoded frames of a private call through the library's
 * `CallMediaFrameCipher`, which holds the call key only as a non-extractable
 * AES-GCM CryptoKey. Every browser path encrypts through it, so members on
 * different browsers hear each other.
 */
export class CallMediaFrameCodec {
  /** The view's bytes as an ArrayBuffer, copied only if it is a slice. */
  private static arrayBuffer(bytes: Uint8Array): ArrayBuffer {
    if (
      bytes.buffer instanceof ArrayBuffer &&
      bytes.byteOffset === 0 &&
      bytes.byteLength === bytes.buffer.byteLength
    )
      return bytes.buffer;

    return Uint8Array.from(bytes).buffer;
  }

  /** The cipher of a base64 call key. */
  public static cipherOfKey(base64Key: string): Promise<CallMediaFrameCipher> {
    return CallMediaFrameCipher.fromKey(SymmetricKey.fromBase64(base64Key));
  }

  /** The cipher of raw call key bytes, which it overwrites with zeros. */
  public static async cipherOfRawKey(
    rawKey: ArrayBuffer,
  ): Promise<CallMediaFrameCipher> {
    const bytes = Buffer.from(rawKey);

    try {
      return await CallMediaFrameCipher.fromKey(SymmetricKey.fromBuffer(bytes));
    } finally {
      bytes.fill(0);
    }
  }

  /** The bytes of a base64 call key, to transfer to a worker. */
  public static rawKey(base64Key: string): ArrayBuffer {
    const bytes = SymmetricKey.fromBase64(base64Key).getBuffer();

    try {
      return Uint8Array.from(bytes).buffer;
    } finally {
      bytes.fill(0);
    }
  }

  public constructor(private readonly cipher: Promise<CallMediaFrameCipher>) {}

  /** Decrypts inbound frames, dropping any the call key does not open. */
  public receiverTransform(): TransformStream<
    EncodedCallMediaFrame,
    EncodedCallMediaFrame
  > {
    return new TransformStream<EncodedCallMediaFrame, EncodedCallMediaFrame>({
      transform: async (frame, controller): Promise<void> => {
        const bytes = new Uint8Array(frame.data);

        // A private call never plays plaintext media: frames without the
        // marker, or that do not authenticate, never reach the decoder.
        if (!CallMediaFrameCipher.hasMarker(bytes)) return;

        try {
          const decryptedFrame = frame;

          decryptedFrame.data = CallMediaFrameCodec.arrayBuffer(
            await (await this.cipher).open(bytes),
          );
          controller.enqueue(decryptedFrame);
        } catch {
          // Dropped: it was not encrypted with the call key.
        }
      },
    });
  }

  /** Encrypts outbound frames; none leaves before the call key is ready. */
  public senderTransform(): TransformStream<
    EncodedCallMediaFrame,
    EncodedCallMediaFrame
  > {
    return new TransformStream<EncodedCallMediaFrame, EncodedCallMediaFrame>({
      transform: async (frame, controller): Promise<void> => {
        const encryptedFrame = frame;

        encryptedFrame.data = CallMediaFrameCodec.arrayBuffer(
          await (await this.cipher).seal(new Uint8Array(encryptedFrame.data)),
        );
        controller.enqueue(encryptedFrame);
      },
    });
  }
}
