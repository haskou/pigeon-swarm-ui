import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import { EncodedCallMediaCipher } from '../../../../../contexts/calls/infrastructure/media/EncodedCallMediaCipher';

type EncodedFrame = RTCEncodedAudioFrame | RTCEncodedVideoFrame;

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

describe(EncodedCallMediaCipher.name, () => {
  const media = new Uint8Array([1, 2, 3, 4, 5, 6]);

  it('restores the media another member encrypted with the call key', async () => {
    const key = SymmetricKey.generate().valueOf();
    const encrypted = await piped([media], (sender) =>
      new EncodedCallMediaCipher(key).configureSender(sender),
    );

    await expect(
      piped(encrypted, (receiver) =>
        new EncodedCallMediaCipher(key).configureReceiver(receiver),
      ),
    ).resolves.toEqual([media]);
  });

  it('drops inbound frames that are not encrypted', async () => {
    await expect(
      piped([media], (receiver) =>
        new EncodedCallMediaCipher(
          SymmetricKey.generate().valueOf(),
        ).configureReceiver(receiver),
      ),
    ).resolves.toEqual([]);
  });

  it('drops inbound frames encrypted with another key', async () => {
    const encrypted = await piped([media], (sender) =>
      new EncodedCallMediaCipher(
        SymmetricKey.generate().valueOf(),
      ).configureSender(sender),
    );

    await expect(
      piped(encrypted, (receiver) =>
        new EncodedCallMediaCipher(
          SymmetricKey.generate().valueOf(),
        ).configureReceiver(receiver),
      ),
    ).resolves.toEqual([]);
  });
});
