import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import { EncodedStreamsCallMediaCipher } from '../../../../../contexts/calls/infrastructure/media/EncodedStreamsCallMediaCipher';

type EncodedFrame = RTCEncodedAudioFrame | RTCEncodedVideoFrame;

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
  await finished;

  return written;
}

describe(EncodedStreamsCallMediaCipher.name, () => {
  const media = new Uint8Array([1, 2, 3, 4, 5, 6]);

  it('restores the media another member encrypted with the call key', async () => {
    const key = SymmetricKey.generate().valueOf();
    const encrypted = await piped([media], (sender) =>
      new EncodedStreamsCallMediaCipher(key).configureSender(sender),
    );

    await expect(
      piped(encrypted, (receiver) =>
        new EncodedStreamsCallMediaCipher(key).configureReceiver(receiver),
      ),
    ).resolves.toEqual([media]);
  });

  it('drops inbound frames that are not encrypted', async () => {
    await expect(
      piped([media], (receiver) =>
        new EncodedStreamsCallMediaCipher(
          SymmetricKey.generate().valueOf(),
        ).configureReceiver(receiver),
      ),
    ).resolves.toEqual([]);
  });

  it('drops inbound frames encrypted with another key', async () => {
    const encrypted = await piped([media], (sender) =>
      new EncodedStreamsCallMediaCipher(
        SymmetricKey.generate().valueOf(),
      ).configureSender(sender),
    );

    await expect(
      piped(encrypted, (receiver) =>
        new EncodedStreamsCallMediaCipher(
          SymmetricKey.generate().valueOf(),
        ).configureReceiver(receiver),
      ),
    ).resolves.toEqual([]);
  });

  it('asks the peer connection for encoded insertable streams', () => {
    expect(
      new EncodedStreamsCallMediaCipher(
        SymmetricKey.generate().valueOf(),
      ).peerConfiguration({ iceServers: [] }),
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
    const cipher = new EncodedStreamsCallMediaCipher(
      SymmetricKey.generate().valueOf(),
    );

    expect(cipher.failed).toBe(false);
    expect(cipher.configureSender(sender as RTCRtpSender)).toBe(false);
    expect(cipher.failed).toBe(true);
  });

  it('encrypts nothing once it has failed, not even what it already did', () => {
    const cipher = new EncodedStreamsCallMediaCipher(
      SymmetricKey.generate().valueOf(),
    );
    const sender = {
      createEncodedStreams: jest.fn(emptyEncodedStreams),
    } as unknown as RTCRtpSender;
    const createReceiverStreams = jest.fn(emptyEncodedStreams);

    expect(cipher.configureSender(sender)).toBe(true);
    cipher.configureReceiver({} as RTCRtpReceiver);

    expect(cipher.configureSender(sender)).toBe(false);
    expect(
      cipher.configureReceiver({
        createEncodedStreams: createReceiverStreams,
      } as unknown as RTCRtpReceiver),
    ).toBe(false);
    expect(createReceiverStreams).not.toHaveBeenCalled();
  });
});
