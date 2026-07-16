import { AttachmentBinaryCodec } from '../../../../../contexts/attachments/infrastructure/crypto/AttachmentBinaryCodec';

describe(AttachmentBinaryCodec.name, () => {
  const codec = new AttachmentBinaryCodec();

  it('round-trips bytes through base64', () => {
    const bytes = new Uint8Array([1, 2, 3]);

    expect([...codec.base64ToBytes(codec.bytesToBase64(bytes))]).toEqual([
      1, 2, 3,
    ]);
  });

  it('concatenates binary values without sharing mutable buffers', () => {
    const result = new Uint8Array(
      codec.concatArrayBuffers([
        codec.bytesToArrayBuffer(new Uint8Array([1, 2])),
        codec.bytesToArrayBuffer(new Uint8Array([3])),
      ]),
    );

    expect([...result]).toEqual([1, 2, 3]);
  });
});
