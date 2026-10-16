import {
  CallMediaFrameOpener,
  CallMediaFrameSealer,
  SymmetricKey,
} from '@haskou/pigeon-swarm-crypto';
import vector from '@haskou/pigeon-swarm-crypto/vectors/call-media-frame.json';

import type { CallMediaEncryptionWorkerScope } from '../../../../../contexts/calls/infrastructure/media/CallMediaEncryptionWorkerScope';
import type { CallMediaTransformOptions } from '../../../../../contexts/calls/infrastructure/media/CallMediaTransformOptions';
import type { CallMediaWorkerMessage } from '../../../../../contexts/calls/infrastructure/media/CallMediaWorkerMessage';
import type { EncodedCallMediaFrame } from '../../../../../contexts/calls/infrastructure/media/EncodedCallMediaFrame';

import { serveCallMediaEncryption } from '../../../../../contexts/calls/infrastructure/media/serveCallMediaEncryption';

const callId = vector.callId;
const alice = vector.senderId;
const media = new Uint8Array([1, 2, 3, 4, 5, 6]);

function bytes(base64url: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64url, 'base64url'));
}

function rawKey(base64Key: string): ArrayBuffer {
  return Uint8Array.from(Buffer.from(base64Key, 'base64')).buffer;
}

/** The epoch in a PSCE2 frame header. */
function epochOf(frame: Uint8Array): number {
  return Buffer.from(frame).readUInt32BE(5);
}

/** The sealer id in a PSCE2 frame header. */
function sealerOf(frame: Uint8Array): string {
  return Buffer.from(frame.slice(9, 17)).toString('hex');
}

/** `media` in the retired PSCE1 format: marker, 12-byte nonce, AES-GCM. */
async function psce1Frame(base64Key: string): Promise<Uint8Array> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { iv: nonce, name: 'AES-GCM' },
    await crypto.subtle.importKey('raw', rawKey(base64Key), 'AES-GCM', false, [
      'encrypt',
    ]),
    media,
  );

  return Uint8Array.from([
    0x50,
    0x53,
    0x43,
    0x45,
    0x31,
    ...nonce,
    ...new Uint8Array(ciphertext),
  ]);
}

/**
 * A dedicated worker serving call media encryption, driven the way a browser
 * drives it: the call and its keys arrive by message and each
 * RTCRtpScriptTransform hands it the encoded frames of one sender or receiver.
 */
class CallMediaEncryptionWorker {
  private readonly scope: CallMediaEncryptionWorkerScope = {
    onmessage: null,
    onrtctransform: null,
  };

  public constructor(senderId: string = alice) {
    serveCallMediaEncryption(this.scope);
    this.post({ callId, senderId, type: 'call' });
  }

  public forget(senderId: string): void {
    this.post({ senderId, type: 'forget' });
  }

  public post(message: CallMediaWorkerMessage): void {
    this.scope.onmessage?.({ data: message } as MessageEvent<unknown>);
  }

  /** Sends the call key of `epoch` by message, returning the bytes it sent. */
  public receiveKey(base64Key: string, epoch: number): ArrayBuffer {
    const key = rawKey(base64Key);

    this.post({ epoch, key, type: 'key' });

    return key;
  }

  /** The frames this worker lets through `frames`, once all are handled. */
  public async transform(
    options: CallMediaTransformOptions | Record<string, unknown>,
    frames: readonly Uint8Array[],
  ): Promise<Uint8Array[]> {
    const written: Uint8Array[] = [];
    let closed: () => void = () => undefined;
    const finished = new Promise<void>((resolve) => {
      closed = resolve;
    });

    this.scope.onrtctransform?.({
      transformer: {
        options,
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

function keyedWorker(
  base64Key: string,
  epoch = 0,
  senderId = alice,
): CallMediaEncryptionWorker {
  const worker = new CallMediaEncryptionWorker(senderId);

  worker.receiveKey(base64Key, epoch);

  return worker;
}

async function openerOf(
  base64Key: string,
  epoch: number,
  senderId = alice,
): Promise<CallMediaFrameOpener> {
  const opener = CallMediaFrameOpener.create({ callId, senderId });

  await opener.addKey(SymmetricKey.fromBase64(base64Key), epoch);

  return opener;
}

describe(serveCallMediaEncryption.name, () => {
  const receiveFromAlice = (
    track: CallMediaTransformOptions['track'],
  ): CallMediaTransformOptions => ({ senderId: alice, side: 'receive', track });

  it('opens the shipped PSCE2 frames of their sender on their tracks', async () => {
    const worker = keyedWorker(vector.key, vector.epoch);

    for (const frame of vector.frames) {
      await expect(
        worker.transform(
          receiveFromAlice(frame.track as CallMediaTransformOptions['track']),
          [bytes(frame.frame)],
        ),
      ).resolves.toEqual([bytes(frame.plaintext)]);
    }
  });

  it('drops a replayed frame', async () => {
    const [frame] = vector.frames;

    await expect(
      keyedWorker(vector.key, vector.epoch).transform(
        receiveFromAlice('audio'),
        [bytes(frame.frame), bytes(frame.frame)],
      ),
    ).resolves.toEqual([bytes(frame.plaintext)]);
  });

  it('drops a frame replayed on another receiver of the same sender', async () => {
    const [frame] = vector.frames;
    const worker = keyedWorker(vector.key, vector.epoch);

    await worker.transform(receiveFromAlice('audio'), [bytes(frame.frame)]);

    await expect(
      worker.transform(receiveFromAlice('audio'), [bytes(frame.frame)]),
    ).resolves.toEqual([]);
  });

  it('drops a frame moved to another track', async () => {
    const [audioFrame] = vector.frames;

    await expect(
      keyedWorker(vector.key, vector.epoch).transform(
        receiveFromAlice('video'),
        [bytes(audioFrame.frame)],
      ),
    ).resolves.toEqual([]);
  });

  it('drops a frame moved to another sender', async () => {
    const [frame] = vector.frames;

    await expect(
      keyedWorker(vector.key, vector.epoch).transform(
        { senderId: 'identity-bob', side: 'receive', track: 'audio' },
        [bytes(frame.frame)],
      ),
    ).resolves.toEqual([]);
  });

  it('drops a frame in the retired PSCE1 format', async () => {
    const key = SymmetricKey.generate().valueOf();

    await expect(
      keyedWorker(key).transform(receiveFromAlice('audio'), [
        await psce1Frame(key),
      ]),
    ).resolves.toEqual([]);
  });

  it('drops inbound frames that are not encrypted', async () => {
    await expect(
      keyedWorker(SymmetricKey.generate().valueOf()).transform(
        receiveFromAlice('audio'),
        [media],
      ),
    ).resolves.toEqual([]);
  });

  it('drops inbound frames sealed with another key', async () => {
    const [frame] = vector.frames;

    await expect(
      keyedWorker(SymmetricKey.generate().valueOf(), vector.epoch).transform(
        receiveFromAlice('audio'),
        [bytes(frame.frame)],
      ),
    ).resolves.toEqual([]);
  });

  it('seals outbound frames that only its sender opens, on the same track', async () => {
    const key = SymmetricKey.generate().valueOf();
    const [frame] = await keyedWorker(key, 3).transform(
      { senderId: alice, side: 'send', track: 'screen-video' },
      [media],
    );

    expect(epochOf(frame)).toBe(3);
    await expect(
      (await openerOf(key, 3)).open(frame, 'screen-video'),
    ).resolves.toEqual(media);
    await expect(
      (await openerOf(key, 3)).open(frame, 'video'),
    ).rejects.toThrow();
    await expect(
      (await openerOf(key, 3, 'identity-bob')).open(frame, 'screen-video'),
    ).rejects.toThrow();
  });

  it('round-trips media between two members holding the call key', async () => {
    const key = SymmetricKey.generate().valueOf();
    const sealed = await keyedWorker(key).transform(
      { senderId: alice, side: 'send', track: 'audio' },
      [media, media],
    );

    await expect(
      keyedWorker(key, 0, 'identity-bob').transform(
        receiveFromAlice('audio'),
        sealed,
      ),
    ).resolves.toEqual([media, media]);
  });

  it('holds outbound frames until the call key arrives, then seals them', async () => {
    const key = SymmetricKey.generate().valueOf();
    const worker = new CallMediaEncryptionWorker();
    let handled = false;
    const transforming = worker
      .transform({ senderId: alice, side: 'send', track: 'audio' }, [media])
      .then((frames) => {
        handled = true;

        return frames;
      });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(handled).toBe(false);

    worker.receiveKey(key, 0);
    const [frame] = await transforming;

    await expect(
      (await openerOf(key, 0)).open(frame, 'audio'),
    ).resolves.toEqual(media);
  });

  it('seals with a new sealer of the new epoch once rekeyed', async () => {
    const key = SymmetricKey.generate().valueOf();
    const nextKey = SymmetricKey.generate().valueOf();
    const worker = keyedWorker(key, 1);
    const sending: CallMediaTransformOptions = {
      senderId: alice,
      side: 'send',
      track: 'audio',
    };
    const [before] = await worker.transform(sending, [media]);

    worker.receiveKey(nextKey, 2);
    const [after] = await worker.transform(sending, [media]);

    expect(epochOf(before)).toBe(1);
    expect(epochOf(after)).toBe(2);
    expect(sealerOf(after)).not.toBe(sealerOf(before));
    await expect(
      (await openerOf(nextKey, 2)).open(after, 'audio'),
    ).resolves.toEqual(media);
  });

  it('ignores a key of an epoch it already holds or passed', async () => {
    const key = SymmetricKey.generate().valueOf();
    const worker = keyedWorker(key, 5);

    worker.receiveKey(SymmetricKey.generate().valueOf(), 4);
    worker.receiveKey(SymmetricKey.generate().valueOf(), 5);
    const [frame] = await worker.transform(
      { senderId: alice, side: 'send', track: 'audio' },
      [media],
    );

    await expect(
      (await openerOf(key, 5)).open(frame, 'audio'),
    ).resolves.toEqual(media);
  });

  it('opens frames sealed before a rekey until the first frame of the new epoch', async () => {
    const key = SymmetricKey.generate().valueOf();
    const nextKey = SymmetricKey.generate().valueOf();
    const oldSealer = await CallMediaFrameSealer.create(
      SymmetricKey.fromBase64(key),
      { callId, epoch: 1, senderId: alice },
    );
    const newSealer = await CallMediaFrameSealer.create(
      SymmetricKey.fromBase64(nextKey),
      { callId, epoch: 2, senderId: alice },
    );
    const heard = await oldSealer.seal(media, 'audio');
    const late = await oldSealer.seal(media, 'audio');
    const later = await oldSealer.seal(media, 'audio');
    const rekeyed = await newSealer.seal(media, 'audio');
    const worker = keyedWorker(key, 1, 'identity-bob');

    await worker.transform(receiveFromAlice('audio'), [heard]);
    worker.receiveKey(nextKey, 2);

    await expect(
      worker.transform(receiveFromAlice('audio'), [late, rekeyed, later]),
    ).resolves.toEqual([media, media]);
  });

  it('keys a sender first heard after a rekey with the newest epoch', async () => {
    const key = SymmetricKey.generate().valueOf();
    const nextKey = SymmetricKey.generate().valueOf();
    const worker = keyedWorker(key, 1, 'identity-bob');
    const sealer = await CallMediaFrameSealer.create(
      SymmetricKey.fromBase64(nextKey),
      { callId, epoch: 2, senderId: alice },
    );

    worker.receiveKey(nextKey, 2);

    await expect(
      worker.transform(receiveFromAlice('audio'), [
        await sealer.seal(media, 'audio'),
      ]),
    ).resolves.toEqual([media]);
  });

  it('opens a forgotten sender afresh when it is heard again', async () => {
    const [frame] = vector.frames;
    const worker = keyedWorker(vector.key, vector.epoch);

    await worker.transform(receiveFromAlice('audio'), [bytes(frame.frame)]);
    worker.forget(alice);

    await expect(
      worker.transform(receiveFromAlice('audio'), [bytes(frame.frame)]),
    ).resolves.toEqual([bytes(frame.plaintext)]);
  });

  it('overwrites the key bytes of an epoch with zeros once a newer one arrives', async () => {
    const worker = new CallMediaEncryptionWorker();
    const sent = worker.receiveKey(SymmetricKey.generate().valueOf(), 1);

    worker.receiveKey(SymmetricKey.generate().valueOf(), 2);
    await worker.transform({ senderId: alice, side: 'send', track: 'audio' }, [
      media,
    ]);

    expect(new Uint8Array(sent).every((byte) => byte === 0)).toBe(true);
  });

  it.each([
    { side: 'unknown', track: 'audio' },
    { senderId: alice, side: 'send', track: 'camera' },
    { side: 'receive', track: 'audio' },
    { senderId: '', side: 'receive', track: 'audio' },
  ])('passes nothing through a transform with options %j', async (options) => {
    const worker = keyedWorker(vector.key, vector.epoch);

    await expect(
      worker.transform(options, [media, bytes(vector.frames[0].frame)]),
    ).resolves.toEqual([]);
  });
});
