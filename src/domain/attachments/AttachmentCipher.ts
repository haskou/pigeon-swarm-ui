import type { MessageAttachment, PendingMessageAttachment } from '../types';

export class AttachmentCipher {
  public async encrypt(file: File): Promise<PendingMessageAttachment> {
    const key = await crypto.subtle.generateKey(
      { length: 256, name: 'AES-GCM' },
      true,
      ['decrypt', 'encrypt'],
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const bytes = await file.arrayBuffer();
    const encryptedBytes = await crypto.subtle.encrypt(
      { iv, name: 'AES-GCM' },
      key,
      bytes,
    );
    const rawKey = await crypto.subtle.exportKey('raw', key);

    return {
      encryptedBytes,
      metadata: {
        contentType: file.type || 'application/octet-stream',
        encryption: {
          algorithm: 'AES-GCM',
          iv: this.bytesToBase64(iv),
          key: this.bytesToBase64(new Uint8Array(rawKey)),
        },
        filename: file.name || 'attachment',
        size: file.size,
      },
      uploadFilename: `${crypto.randomUUID()}.bin`,
    };
  }

  public async decrypt(
    attachment: MessageAttachment,
    encryptedBytes: ArrayBuffer,
  ): Promise<Blob> {
    const key = await crypto.subtle.importKey(
      'raw',
      this.base64ToArrayBuffer(attachment.encryption.key),
      { name: 'AES-GCM' },
      false,
      ['decrypt'],
    );
    const bytes = await crypto.subtle.decrypt(
      {
        iv: this.base64ToArrayBuffer(attachment.encryption.iv),
        name: attachment.encryption.algorithm,
      },
      key,
      encryptedBytes,
    );

    return new Blob([bytes], { type: attachment.contentType });
  }

  public base64ToBytes(value: string): Uint8Array {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  }

  public base64ToArrayBuffer(value: string): ArrayBuffer {
    const bytes = this.base64ToBytes(value);

    return this.bytesToArrayBuffer(bytes);
  }

  public bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    const copy = new Uint8Array(bytes.byteLength);

    copy.set(bytes);

    return copy.buffer;
  }

  private bytesToBase64(bytes: Uint8Array): string {
    let binary = '';

    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    return btoa(binary);
  }
}
