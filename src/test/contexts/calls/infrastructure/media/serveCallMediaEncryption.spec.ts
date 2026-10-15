import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { CallMediaEncryptionWorkerScope } from '../../../../../contexts/calls/infrastructure/media/CallMediaEncryptionWorkerScope';
import type { EncodedCallMediaFrame } from '../../../../../contexts/calls/infrastructure/media/EncodedCallMediaFrame';

import { serveCallMediaEncryption } from '../../../../../contexts/calls/infrastructure/media/serveCallMediaEncryption';

const frameMarker = [0x50, 0x53, 0x43, 0x45, 0x31];
const nonceLength = 12;
const authenticationTagLength = 16;
const ciphertextStart = frameMarker.length + nonceLength;

function rawKey(base64Key: string): ArrayBuffer {
  return Uint8Array.from(Buffer.from(base64Key, 'base64')).buffer;
}

/** `media` in the PSCE1 frame format: marker, 12-byte nonce, AES-GCM. */
async function encryptedFrame(
  base64Key: string,
  media: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array> {
  const nonce = crypto.getRandomValues(new Uint8Array(nonceLength));
  const ciphertext = await crypto.subtle.encrypt(
    { iv: nonce, name: 'AES-GCM' },
    await crypto.subtle.importKey('raw', rawKey(base64Key), 'AES-GCM', false, [
      'encrypt',
    ]),
    media,
  );

  return Uint8Array.from([
    ...frameMarker,
    ...nonce,
    ...new Uint8Array(ciphertext),
  ]);
}

async function decryptedFrame(
  base64Key: string,
  frame: Uint8Array,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    rawKey(base64Key),
    'AES-GCM',
    false,
    ['decrypt'],
  );

  return new Uint8Array(
    await crypto.subtle.decrypt(
      { iv: frame.slice(frameMarker.length, ciphertextStart), name: 'AES-GCM' },
      key,
      frame.slice(ciphertextStart),
    ),
  );
}

/**
 * A dedicated worker serving call media encryption, driven the way a browser
 * drives it: the call key arrives by message and each RTCRtpScriptTransform
 * hands it the encoded frames of one sender or receiver.
 */
class CallMediaEncryptionWorker {
  private readonly scope: CallMediaEncryptionWorkerScope = {
    onmessage: null,
    onrtctransform: null,
  };

  public constructor() {
    serveCallMediaEncryption(this.scope);
  }

  public receiveKey(base64Key: string): void {
    this.scope.onmessage?.({
      data: { key: rawKey(base64Key) },
    } as MessageEvent<unknown>);
  }

  /** The frames this worker lets through `frames`, once all are handled. */
  public async transform(
    side: 'receive' | 'send',
    frames: readonly Uint8Array[],
  ): Promise<Uint8Array[]> {
    const written: Uint8Array[] = [];
    let closed: () => void = () => undefined;
    const finished = new Promise<void>((resolve) => {
      closed = resolve;
    });

    this.scope.onrtctransform?.({
      transformer: {
        options: { side },
        readable: new ReadableStream<EncodedCallMediaFrame>({
          start(controller): void {
            for (const frame of frames) {
              controller.enqueue({
                data: frame.slice().buffer,
              } as RTCEncodedAudioFrame);
            }

            controller.close();
          },
        }),
        writable: new WritableStream<EncodedCallMediaFrame>({
          close(): void {
            closed();
          },
          write(frame): void {
            written.push(new Uint8Array(frame.data));
          },
        }),
      },
    });
    await finished;

    return written;
  }
}

function keyedWorker(base64Key: string): CallMediaEncryptionWorker {
  const worker = new CallMediaEncryptionWorker();

  worker.receiveKey(base64Key);

  return worker;
}

describe(serveCallMediaEncryption.name, () => {
  const media = new Uint8Array([1, 2, 3, 4, 5, 6]);

  it('encrypts outbound frames in the PSCE1 frame format with the key it was sent', async () => {
    const key = SymmetricKey.generate().valueOf();
    const [frame] = await keyedWorker(key).transform('send', [media]);

    expect([...frame.slice(0, frameMarker.length)]).toEqual(frameMarker);
    expect(frame.byteLength).toBe(
      ciphertextStart + media.byteLength + authenticationTagLength,
    );
    await expect(decryptedFrame(key, frame)).resolves.toEqual(media);
  });

  it('never reuses a nonce across frames', async () => {
    const frames = await keyedWorker(
      SymmetricKey.generate().valueOf(),
    ).transform('send', [media, media]);
    const nonces = frames.map((frame) =>
      Buffer.from(frame.slice(frameMarker.length, ciphertextStart)).toString(
        'hex',
      ),
    );

    expect(new Set(nonces).size).toBe(2);
  });

  it('restores inbound frames another member encrypted with the call key', async () => {
    const key = SymmetricKey.generate().valueOf();

    await expect(
      keyedWorker(key).transform('receive', [await encryptedFrame(key, media)]),
    ).resolves.toEqual([media]);
  });

  it('round-trips media between two members holding the call key', async () => {
    const key = SymmetricKey.generate().valueOf();
    const encrypted = await keyedWorker(key).transform('send', [media]);

    await expect(
      keyedWorker(key).transform('receive', encrypted),
    ).resolves.toEqual([media]);
  });

  it('drops inbound frames that are not encrypted', async () => {
    await expect(
      keyedWorker(SymmetricKey.generate().valueOf()).transform('receive', [
        media,
      ]),
    ).resolves.toEqual([]);
  });

  it('drops inbound frames encrypted with another key', async () => {
    const frame = await encryptedFrame(
      SymmetricKey.generate().valueOf(),
      media,
    );

    await expect(
      keyedWorker(SymmetricKey.generate().valueOf()).transform('receive', [
        frame,
      ]),
    ).resolves.toEqual([]);
  });

  it('drops inbound frames whose ciphertext was tampered with', async () => {
    const key = SymmetricKey.generate().valueOf();
    const frame = await encryptedFrame(key, media);

    frame[frame.byteLength - 1] = frame[frame.byteLength - 1] === 0 ? 1 : 0;

    await expect(
      keyedWorker(key).transform('receive', [frame]),
    ).resolves.toEqual([]);
  });

  it('holds outbound frames until the call key arrives, then encrypts them', async () => {
    const key = SymmetricKey.generate().valueOf();
    const worker = new CallMediaEncryptionWorker();
    let handled = false;
    const transforming = worker.transform('send', [media]).then((frames) => {
      handled = true;

      return frames;
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(handled).toBe(false);

    worker.receiveKey(key);
    const [frame] = await transforming;

    await expect(decryptedFrame(key, frame)).resolves.toEqual(media);
  });

  it('decrypts on a transform that does not say which side it runs on', async () => {
    await expect(
      new CallMediaEncryptionWorker().transform('unknown' as 'receive', [
        media,
      ]),
    ).resolves.toEqual([]);
  });
});
