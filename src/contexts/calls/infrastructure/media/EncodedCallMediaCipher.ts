import type { EncodedCallMediaFrame } from './EncodedCallMediaFrame';
import type { EncodedCallMediaFrameStreams } from './EncodedCallMediaFrameStreams';
import type { EncodedCallMediaStreamOwner } from './EncodedCallMediaStreamOwner';

const frameMarker = new Uint8Array([0x50, 0x53, 0x43, 0x45, 0x31]);
const nonceLength = 12;

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);

  new Uint8Array(buffer).set(bytes);

  return buffer;
}

function concatBytes(...parts: Uint8Array[]): ArrayBuffer {
  const totalLength = parts.reduce((total, part) => total + part.byteLength, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }

  return output.buffer;
}

function hasEncryptedFrameMarker(bytes: Uint8Array): boolean {
  if (bytes.byteLength <= frameMarker.byteLength + nonceLength) return false;

  return frameMarker.every((byte, index) => bytes[index] === byte);
}

function isEncodedStreamOwner(
  value: unknown,
): value is EncodedCallMediaStreamOwner {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as EncodedCallMediaStreamOwner).createEncodedStreams ===
      'function'
  );
}

function encodedStreamsSupported(): boolean {
  return (
    typeof TransformStream !== 'undefined' &&
    typeof crypto !== 'undefined' &&
    !!crypto.subtle &&
    typeof RTCRtpSender !== 'undefined' &&
    typeof RTCRtpReceiver !== 'undefined' &&
    isEncodedStreamOwner(RTCRtpSender.prototype) &&
    isEncodedStreamOwner(RTCRtpReceiver.prototype)
  );
}

export class EncodedCallMediaCipher {
  private readonly cryptoKey: Promise<CryptoKey>;

  private readonly configuredReceivers = new WeakSet<RTCRtpReceiver>();

  private readonly configuredSenders = new WeakSet<RTCRtpSender>();

  private static configureEncodedStreams(
    owner: EncodedCallMediaStreamOwner,
    transform: TransformStream<EncodedCallMediaFrame, EncodedCallMediaFrame>,
  ): boolean {
    let streams: EncodedCallMediaFrameStreams | undefined;

    try {
      streams = owner.createEncodedStreams?.();
    } catch {
      return false;
    }

    if (!streams) return false;

    void streams.readable
      .pipeThrough(transform)
      .pipeTo(streams.writable)
      .catch(() => undefined);

    return true;
  }

  public static isSupported(): boolean {
    return encodedStreamsSupported();
  }

  public constructor(private readonly base64Key: string) {
    this.cryptoKey = this.importCryptoKey();
  }

  private async importCryptoKey(): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
      'raw',
      toArrayBuffer(base64ToBytes(this.base64Key)),
      { name: 'AES-GCM' },
      false,
      ['decrypt', 'encrypt'],
    );
  }

  private async encryptFrameData(data: ArrayBuffer): Promise<ArrayBuffer> {
    const nonce = new Uint8Array(nonceLength);

    crypto.getRandomValues(nonce);

    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt(
        { iv: nonce, name: 'AES-GCM' },
        await this.cryptoKey,
        data,
      ),
    );

    return concatBytes(frameMarker, nonce, ciphertext);
  }

  private async decryptFrameData(data: ArrayBuffer): Promise<ArrayBuffer> {
    const bytes = new Uint8Array(data);

    if (!hasEncryptedFrameMarker(bytes)) return data;

    const nonceStart = frameMarker.byteLength;
    const ciphertextStart = nonceStart + nonceLength;

    return await crypto.subtle.decrypt(
      {
        iv: toArrayBuffer(bytes.slice(nonceStart, ciphertextStart)),
        name: 'AES-GCM',
      },
      await this.cryptoKey,
      toArrayBuffer(bytes.slice(ciphertextStart)),
    );
  }

  private senderTransform(
    shouldEncrypt: () => boolean,
  ): TransformStream<EncodedCallMediaFrame, EncodedCallMediaFrame> {
    return new TransformStream<EncodedCallMediaFrame, EncodedCallMediaFrame>({
      transform: async (frame, controller): Promise<void> => {
        const transformedFrame = frame;

        if (shouldEncrypt()) {
          transformedFrame.data = await this.encryptFrameData(
            transformedFrame.data,
          );
        }

        controller.enqueue(transformedFrame);
      },
    });
  }

  private receiverTransform(): TransformStream<
    EncodedCallMediaFrame,
    EncodedCallMediaFrame
  > {
    return new TransformStream<EncodedCallMediaFrame, EncodedCallMediaFrame>({
      transform: async (frame, controller): Promise<void> => {
        try {
          const transformedFrame = frame;

          transformedFrame.data = await this.decryptFrameData(
            transformedFrame.data,
          );
          controller.enqueue(transformedFrame);
        } catch {
          // Drop frames that cannot be authenticated instead of passing
          // ciphertext to the media decoder.
        }
      },
    });
  }

  public configureSender(
    sender: RTCRtpSender,
    shouldEncrypt: () => boolean,
  ): void {
    if (this.configuredSenders.has(sender)) return;

    if (!isEncodedStreamOwner(sender)) return;

    const configured = EncodedCallMediaCipher.configureEncodedStreams(
      sender,
      this.senderTransform(shouldEncrypt),
    );

    if (configured) this.configuredSenders.add(sender);
  }

  public configureReceiver(receiver: RTCRtpReceiver): void {
    if (this.configuredReceivers.has(receiver)) return;

    if (!isEncodedStreamOwner(receiver)) return;

    const configured = EncodedCallMediaCipher.configureEncodedStreams(
      receiver,
      this.receiverTransform(),
    );

    if (configured) this.configuredReceivers.add(receiver);
  }
}
