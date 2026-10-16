import {
  CallMediaFrameOpener,
  SymmetricKey,
} from '@haskou/pigeon-swarm-crypto';

import type { CallMediaKey } from '../../../../../contexts/calls/infrastructure/media/CallMediaKey';

import { EncodedStreamsCallMediaCipher } from '../../../../../contexts/calls/infrastructure/media/EncodedStreamsCallMediaCipher';

type EncodedFrame = RTCEncodedAudioFrame | RTCEncodedVideoFrame;

const alice = { callId: 'call-1', senderId: 'identity-alice' };
const bob = { callId: 'call-1', senderId: 'identity-bob' };

function callKey(epoch = 0): CallMediaKey {
  return { epoch, key: SymmetricKey.generate().valueOf() };
}

function emptyEncodedStreams(): {
  readable: ReadableStream<EncodedFrame>;
  writable: WritableStream<EncodedFrame>;
} {
  return { readable: new ReadableStream(), writable: new WritableStream() };
}

/** The frames `configure` lets through `frames`, once all are handled. */
async function piped(
  frames: readonly Uint8Array[],
  configure: (owner: RTCRtpReceiver & RTCRtpSender) => void,
  afterConfigure: () => void = () => undefined,
): Promise<Uint8Array[]> {
  const written: Uint8Array[] = [];
  let closed: () => void = () => undefined;
  const finished = new Promise<void>((resolve) => {
    closed = resolve;
  });
  const owner = {
    createEncodedStreams: () => ({
      readable: new ReadableStream<EncodedFrame>({
        start(controller): void {
          for (const frame of frames) {
            controller.enqueue({
              data: frame.slice().buffer,
            } as RTCEncodedAudioFrame);
          }

          controller.close();
        },
      }),
      writable: new WritableStream<EncodedFrame>({
        close(): void {
          closed();
        },
        write(frame): void {
          written.push(new Uint8Array(frame.data));
        },
      }),
    }),
  } as unknown as RTCRtpReceiver & RTCRtpSender;

  configure(owner);
  afterConfigure();
  await finished;

  return written;
}

describe(EncodedStreamsCallMediaCipher.name, () => {
  const media = new Uint8Array([1, 2, 3, 4, 5, 6]);

  it('restores the media another member sealed with the call key', async () => {
    const key = callKey();
    const sealed = await piped([media], (sender) =>
      new EncodedStreamsCallMediaCipher(alice, key).configureSender(
        sender,
        'audio',
      ),
    );

    await expect(
      piped(sealed, (receiver) =>
        new EncodedStreamsCallMediaCipher(bob, key).configureReceiver(
          receiver,
          alice.senderId,
          'audio',
        ),
      ),
    ).resolves.toEqual([media]);
  });

  it('drops media sealed for another track or by another member', async () => {
    const key = callKey();
    const sealed = await piped([media], (sender) =>
      new EncodedStreamsCallMediaCipher(alice, key).configureSender(
        sender,
        'audio',
      ),
    );
    const receiving = new EncodedStreamsCallMediaCipher(bob, key);

    await expect(
      piped(sealed, (receiver) =>
        receiving.configureReceiver(receiver, alice.senderId, 'screen-audio'),
      ),
    ).resolves.toEqual([]);
    await expect(
      piped(sealed, (receiver) =>
        receiving.configureReceiver(receiver, 'identity-carol', 'audio'),
      ),
    ).resolves.toEqual([]);
  });

  it('seals for the track a sender moved to', async () => {
    const key = callKey();
    const cipher = new EncodedStreamsCallMediaCipher(alice, key);
    const opener = CallMediaFrameOpener.create(alice);
    let moved: RTCRtpSender | undefined;
    const [frame] = await piped(
      [media],
      (sender) => {
        moved = sender;
        cipher.configureSender(sender, 'video');
      },
      () => cipher.configureSender(moved as RTCRtpSender, 'screen-video'),
    );

    await opener.addKey(SymmetricKey.fromBase64(key.key), 0);
    await expect(opener.open(frame, 'screen-video')).resolves.toEqual(media);
  });

  it('seals with the key of a newer epoch once rekeyed', async () => {
    const nextKey = callKey(1);
    const cipher = new EncodedStreamsCallMediaCipher(alice, callKey());
    const opener = CallMediaFrameOpener.create(alice);

    cipher.rekey(nextKey);
    const [frame] = await piped([media], (sender) =>
      cipher.configureSender(sender, 'audio'),
    );

    await opener.addKey(SymmetricKey.fromBase64(nextKey.key), 1);
    await expect(opener.open(frame, 'audio')).resolves.toEqual(media);
  });

  it('drops inbound frames that are not sealed', async () => {
    await expect(
      piped([media], (receiver) =>
        new EncodedStreamsCallMediaCipher(bob, callKey()).configureReceiver(
          receiver,
          alice.senderId,
          'audio',
        ),
      ),
    ).resolves.toEqual([]);
  });

  it('drops inbound frames sealed with another key', async () => {
    const sealed = await piped([media], (sender) =>
      new EncodedStreamsCallMediaCipher(alice, callKey()).configureSender(
        sender,
        'audio',
      ),
    );

    await expect(
      piped(sealed, (receiver) =>
        new EncodedStreamsCallMediaCipher(bob, callKey()).configureReceiver(
          receiver,
          alice.senderId,
          'audio',
        ),
      ),
    ).resolves.toEqual([]);
  });

  it('asks the peer connection for encoded insertable streams', () => {
    expect(
      new EncodedStreamsCallMediaCipher(alice, callKey()).peerConfiguration({
        iceServers: [],
      }),
    ).toEqual({ encodedInsertableStreams: true, iceServers: [] });
  });

  it.each([
    [
      'rejects encoded streams',
      {
        createEncodedStreams: () => {
          throw new Error('Encoded insertable streams are disabled.');
        },
      },
    ],
    ['has no encoded streams', {}],
  ])('fails when the browser %s', (_case, sender) => {
    const cipher = new EncodedStreamsCallMediaCipher(alice, callKey());

    expect(cipher.failed).toBe(false);
    expect(cipher.configureSender(sender as RTCRtpSender, 'audio')).toBe(false);
    expect(cipher.failed).toBe(true);
  });

  it('encrypts nothing once it has failed, not even what it already did', () => {
    const cipher = new EncodedStreamsCallMediaCipher(alice, callKey());
    const sender = {
      createEncodedStreams: jest.fn(emptyEncodedStreams),
    } as unknown as RTCRtpSender;
    const createReceiverStreams = jest.fn(emptyEncodedStreams);

    expect(cipher.configureSender(sender, 'audio')).toBe(true);
    cipher.configureReceiver({} as RTCRtpReceiver, bob.senderId, 'audio');

    expect(cipher.configureSender(sender, 'audio')).toBe(false);
    expect(
      cipher.configureReceiver(
        {
          createEncodedStreams: createReceiverStreams,
        } as unknown as RTCRtpReceiver,
        bob.senderId,
        'audio',
      ),
    ).toBe(false);
    expect(createReceiverStreams).not.toHaveBeenCalled();
  });
});
