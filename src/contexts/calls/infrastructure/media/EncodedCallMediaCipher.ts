const frameMarker = new Uint8Array([0x50, 0x53, 0x43, 0x45, 0x31]);
const nonceLength = 12;

type EncodedFrame = RTCEncodedAudioFrame | RTCEncodedVideoFrame;

type EncodedFrameStreams = {
  readable: ReadableStream<EncodedFrame>;
  writable: WritableStream<EncodedFrame>;
};

type EncodedStreamOwner = {
  createEncodedStreams?: () => EncodedFrameStreams;
};

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

function isEncodedStreamOwner(value: unknown): value is EncodedStreamOwner {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as EncodedStreamOwner).createEncodedStreams === 'function'
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
  ): TransformStream<EncodedFrame, EncodedFrame> {
    return new TransformStream<EncodedFrame, EncodedFrame>({
      transform: async (frame, controller): Promise<void> => {
        if (shouldEncrypt()) {
          frame.data = await this.encryptFrameData(frame.data);
        }

        controller.enqueue(frame);
      },
    });
  }

  private receiverTransform(): TransformStream<EncodedFrame, EncodedFrame> {
    return new TransformStream<EncodedFrame, EncodedFrame>({
      transform: async (frame, controller): Promise<void> => {
        try {
          frame.data = await this.decryptFrameData(frame.data);
          controller.enqueue(frame);
        } catch {
          // Drop frames that cannot be authenticated instead of passing
          // ciphertext to the media decoder.
        }
      },
    });
  }

  private static configureEncodedStreams(
    owner: EncodedStreamOwner,
    transform: TransformStream<EncodedFrame, EncodedFrame>,
  ): void {
    const streams = owner.createEncodedStreams?.();

    if (!streams) return;

    void streams.readable
      .pipeThrough(transform)
      .pipeTo(streams.writable)
      .catch(() => undefined);
  }

  public static isSupported(): boolean {
    return encodedStreamsSupported();
  }

  public configureSender(
    sender: RTCRtpSender,
    shouldEncrypt: () => boolean,
  ): void {
    if (this.configuredSenders.has(sender)) return;

    if (!isEncodedStreamOwner(sender)) return;

    this.configuredSenders.add(sender);
    EncodedCallMediaCipher.configureEncodedStreams(
      sender,
      this.senderTransform(shouldEncrypt),
    );
  }

  public configureReceiver(receiver: RTCRtpReceiver): void {
    if (this.configuredReceivers.has(receiver)) return;

    if (!isEncodedStreamOwner(receiver)) return;

    this.configuredReceivers.add(receiver);
    EncodedCallMediaCipher.configureEncodedStreams(
      receiver,
      this.receiverTransform(),
    );
  }
}
