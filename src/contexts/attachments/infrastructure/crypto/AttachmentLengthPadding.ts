const magic = 'PGPAD001';
const headerBytes = magic.length + 8;
const twoToThe32 = 2 ** 32;
const gcmTagBytes = 16;
const chunkCountAtLargestBucket = 7;
const nodeMaxBlobBytes = 50 * 1024 * 1024;

/**
 * Largest frame whose ciphertext is exactly the node's default blob limit
 * (PRIVATE_BLOB_MAX_BYTES). Each 8 MiB AES-GCM chunk adds one 16-byte tag.
 */
const largestBucketBytes =
  nodeMaxBlobBytes - chunkCountAtLargestBucket * gcmTagBytes;

/**
 * Frame sizes for private attachments. A frame is rounded up to the smallest
 * bucket that holds it, so the uploaded length no longer tracks the exact file
 * size. Powers of four from 1 KiB, then the largest frame above. Larger frames
 * keep their exact size.
 */
const bucketSizes: readonly number[] = [
  1024,
  4 * 1024,
  16 * 1024,
  64 * 1024,
  256 * 1024,
  1024 * 1024,
  4 * 1024 * 1024,
  16 * 1024 * 1024,
  largestBucketBytes,
];

const encoder = new TextEncoder();

/**
 * Frame layout: 8-byte magic, 8-byte big-endian payload length, payload, then
 * zero fill up to the bucket size. The frame is encrypted as plaintext, so the
 * magic and length are authenticated by AES-GCM.
 */
export class AttachmentLengthPadding {
  public static readonly marker = 'length-prefix-v1' as const;

  public static paddedSize(plaintextBytes: number): number {
    const framedBytes = headerBytes + plaintextBytes;

    return bucketSizes.find((size) => size >= framedBytes) ?? framedBytes;
  }

  public static pad(bytes: Uint8Array): Uint8Array {
    const frame = new Uint8Array(
      AttachmentLengthPadding.paddedSize(bytes.byteLength),
    );
    const view = new DataView(frame.buffer);

    frame.set(encoder.encode(magic), 0);
    view.setUint32(magic.length, Math.floor(bytes.byteLength / twoToThe32));
    view.setUint32(magic.length + 4, bytes.byteLength % twoToThe32);
    frame.set(bytes, headerBytes);

    return frame;
  }

  public static unpad(frame: Uint8Array): Uint8Array {
    const invalid = new Error('Attachment padding is invalid.');

    if (frame.byteLength < headerBytes) throw invalid;

    const magicBytes = frame.subarray(0, magic.length);

    if (new TextDecoder().decode(magicBytes) !== magic) throw invalid;

    const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
    const length =
      view.getUint32(magic.length) * twoToThe32 +
      view.getUint32(magic.length + 4);

    if (length > frame.byteLength - headerBytes) throw invalid;

    return frame.subarray(headerBytes, headerBytes + length);
  }
}
