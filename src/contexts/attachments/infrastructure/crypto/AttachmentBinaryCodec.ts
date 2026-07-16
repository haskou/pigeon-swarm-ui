export class AttachmentBinaryCodec {
  public base64ToArrayBuffer(value: string): ArrayBuffer {
    return this.bytesToArrayBuffer(this.base64ToBytes(value));
  }

  public base64ToBytes(value: string): Uint8Array {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  }

  public bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    const copy = new Uint8Array(bytes.byteLength);

    copy.set(bytes);

    return copy.buffer;
  }

  public bytesToBase64(bytes: Uint8Array): string {
    let binary = '';

    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    return btoa(binary);
  }

  public concatArrayBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
    const totalSize = buffers.reduce(
      (total, buffer) => total + buffer.byteLength,
      0,
    );
    const output = new Uint8Array(totalSize);
    let offset = 0;

    buffers.forEach((buffer) => {
      output.set(new Uint8Array(buffer), offset);
      offset += buffer.byteLength;
    });

    return output.buffer;
  }

  public concatBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
    const output = new Uint8Array(left.byteLength + right.byteLength);

    output.set(left);
    output.set(right, left.byteLength);

    return output;
  }
}
