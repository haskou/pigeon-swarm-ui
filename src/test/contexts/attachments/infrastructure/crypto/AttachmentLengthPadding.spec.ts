import { AttachmentLengthPadding } from '../../../../../contexts/attachments/infrastructure/crypto/AttachmentLengthPadding';

const mib = 1024 * 1024;
const headerBytes = 16;

function framed(magic: string, declaredLength: number, body = 0): Uint8Array {
  const bytes = new Uint8Array(headerBytes + body);
  bytes.set(new TextEncoder().encode(magic), 0);
  new DataView(bytes.buffer).setUint32(12, declaredLength);

  return bytes;
}

describe(AttachmentLengthPadding.name, () => {
  describe('bucket sizes', () => {
    it.each([
      [0, 1024],
      [1008, 1024],
      [1009, 4 * 1024],
      [4 * 1024 - headerBytes, 4 * 1024],
      [16 * mib - headerBytes, 16 * mib],
      [16 * mib, 50 * mib - 7 * 16],
      [50 * mib - 7 * 16 - headerBytes, 50 * mib - 7 * 16],
    ])('pads %i plaintext bytes to %i bytes', (plaintext, expected) => {
      expect(AttachmentLengthPadding.paddedSize(plaintext)).toBe(expected);
    });

    it('keeps plaintext above the largest bucket at its framed length', () => {
      expect(AttachmentLengthPadding.paddedSize(50 * mib)).toBe(
        50 * mib + headerBytes,
      );
    });
  });

  describe('pad and unpad', () => {
    it.each([0, 1, 1008, 1009, 8 * mib + 9])(
      'round-trips %i bytes into a bucket-sized frame',
      (size) => {
        const source = new Uint8Array(size).fill(7);
        const padded = AttachmentLengthPadding.pad(source);

        expect(padded.byteLength).toBe(AttachmentLengthPadding.paddedSize(size));
        expect(Buffer.from(AttachmentLengthPadding.unpad(padded))).toEqual(
          Buffer.from(source),
        );
      },
    );

    it('writes the magic and the big-endian payload length', () => {
      const padded = AttachmentLengthPadding.pad(new Uint8Array(300));
      const view = new DataView(padded.buffer, padded.byteOffset);

      expect(Buffer.from(padded.subarray(0, 8)).toString('ascii')).toBe(
        'PGPAD001',
      );
      expect(view.getUint32(8)).toBe(0);
      expect(view.getUint32(12)).toBe(300);
    });

    it('fills the rest of the bucket with zeros', () => {
      const padded = AttachmentLengthPadding.pad(new Uint8Array([9, 9]));

      expect(padded.byteLength).toBe(1024);
      expect(padded.subarray(headerBytes + 2)).toEqual(
        new Uint8Array(1024 - headerBytes - 2),
      );
    });

    it.each([
      ['a frame shorter than the header', new Uint8Array(15)],
      ['an unknown magic', framed('XXXXXXXX', 0)],
      ['a declared length beyond the frame', framed('PGPAD001', 1)],
    ])('rejects %s', (_, bytes) => {
      expect(() => AttachmentLengthPadding.unpad(bytes)).toThrow(
        'Attachment padding is invalid.',
      );
    });
  });
});
