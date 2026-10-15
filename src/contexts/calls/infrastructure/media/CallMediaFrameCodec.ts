import type { EncodedCallMediaFrame } from './EncodedCallMediaFrame';

const frameMarker = new Uint8Array([0x50, 0x53, 0x43, 0x45, 0x31]);
const nonceLength = 12;
const ciphertextStart = frameMarker.byteLength + nonceLength;

function hasEncryptedFrameMarker(bytes: Uint8Array): boolean {
  if (bytes.byteLength <= ciphertextStart) return false;

  return frameMarker.every((byte, index) => bytes[index] === byte);
}

/**
 * The encrypted frame format of a private call: the `PSCE1` marker, a random
 * 12-byte nonce, then the AES-GCM ciphertext of the encoded frame under the
 * call key. Every browser path encrypts through it, so members on different
 * browsers hear each other.
 */
export class CallMediaFrameCodec {
  /** The call key as a non-extractable AES-GCM key. */
  public static async importKey(rawKey: ArrayBuffer): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt', 'encrypt'],
    );
  }

  /** The bytes of a base64 call key. */
  public static rawKey(base64Key: string): ArrayBuffer {
    const binary = atob(base64Key);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes.buffer;
  }

  public constructor(private readonly key: Promise<CryptoKey>) {}

  private async encrypt(data: ArrayBuffer): Promise<ArrayBuffer> {
    const nonce = crypto.getRandomValues(new Uint8Array(nonceLength));
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt(
        { iv: nonce, name: 'AES-GCM' },
        await this.key,
        data,
      ),
    );
    const frame = new Uint8Array(ciphertextStart + ciphertext.byteLength);

    frame.set(frameMarker);
    frame.set(nonce, frameMarker.byteLength);
    frame.set(ciphertext, ciphertextStart);

    return frame.buffer;
  }

  /** Rejects for a frame not authenticated with the call key. */
  private async decrypt(bytes: Uint8Array): Promise<ArrayBuffer> {
    return await crypto.subtle.decrypt(
      {
        iv: bytes.slice(frameMarker.byteLength, ciphertextStart),
        name: 'AES-GCM',
      },
      await this.key,
      bytes.slice(ciphertextStart),
    );
  }

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
        if (!hasEncryptedFrameMarker(bytes)) return;

        try {
          const decryptedFrame = frame;

          decryptedFrame.data = await this.decrypt(bytes);
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

        encryptedFrame.data = await this.encrypt(encryptedFrame.data);
        controller.enqueue(encryptedFrame);
      },
    });
  }
}
