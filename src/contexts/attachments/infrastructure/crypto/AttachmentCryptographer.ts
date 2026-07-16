import { UUID } from '@haskou/value-objects';
import { CryptoAdapter } from '@haskou/value-objects/dist/value-objects/crypto/CryptoAdapter';

import type { MessageAttachment } from '../resources/MessageAttachment';
import type { AttachmentProgressHandler } from './AttachmentProgressHandler';
import type { WorkerResponse } from './WorkerResponse';

import { AttachmentBinaryCodec } from './AttachmentBinaryCodec';

const chunkSize = 8 * 1024 * 1024;
const gcmTagBytes = 16;
const largeAttachmentBytes = 5 * 1024 * 1024;

export class AttachmentCryptographer {
  public constructor(private readonly codec: AttachmentBinaryCodec) {}

  private reportProgress(
    phase: 'decrypt' | 'encrypt',
    filename: string,
    size: number,
    index: number,
    onProgress?: AttachmentProgressHandler,
  ): void {
    if (!onProgress || size < largeAttachmentBytes) return;

    onProgress({
      filename,
      percent: Math.min(
        100,
        Math.round(((index + 1) * chunkSize * 100) / size),
      ),
      phase,
    });
  }

  public decrypt(
    attachment: MessageAttachment,
    encryptedBytes: ArrayBuffer,
    onProgress?: AttachmentProgressHandler,
  ): Extract<WorkerResponse, { type: 'decrypt-result' }> {
    if (!attachment.encryption) {
      throw new Error('Attachment is not encrypted.');
    }

    const key = this.codec.base64ToBytes(attachment.encryption.key);
    const chunks = attachment.encryption.chunks ?? [
      { iv: attachment.encryption.iv, size: encryptedBytes.byteLength },
    ];
    const decryptedParts: ArrayBuffer[] = [];
    let offset = 0;

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const encryptedChunk = encryptedBytes.slice(offset, offset + chunk.size);
      const encryptedChunkBytes = new Uint8Array(encryptedChunk);
      const decrypted = CryptoAdapter.decryptAes256Gcm(
        key,
        this.codec.base64ToBytes(chunk.iv),
        encryptedChunkBytes.subarray(0, -gcmTagBytes),
        encryptedChunkBytes.subarray(-gcmTagBytes),
      );

      decryptedParts.push(this.codec.bytesToArrayBuffer(decrypted));
      offset += chunk.size;
      this.reportProgress(
        'decrypt',
        attachment.filename,
        attachment.size,
        index,
        onProgress,
      );
    }

    return {
      bytes: this.codec.concatArrayBuffers(decryptedParts),
      id: UUID.generate().toString(),
      type: 'decrypt-result',
    };
  }

  public encrypt(
    filename: string,
    bytes: ArrayBuffer,
    onProgress?: AttachmentProgressHandler,
  ): Extract<WorkerResponse, { type: 'encrypt-result' }> {
    const key = CryptoAdapter.randomBytes(32);
    const encryptedParts: ArrayBuffer[] = [];
    const chunks: { iv: string; size: number }[] = [];
    const totalChunks = Math.ceil(bytes.byteLength / chunkSize) || 1;

    for (let index = 0; index < totalChunks; index += 1) {
      const offset = index * chunkSize;
      const chunk = bytes.slice(
        offset,
        Math.min(offset + chunkSize, bytes.byteLength),
      );
      const iv = CryptoAdapter.randomBytes(12);
      const encrypted = CryptoAdapter.encryptAes256Gcm(
        key,
        iv,
        new Uint8Array(chunk),
      );
      const encryptedChunk = this.codec.concatBytes(
        encrypted.cipherText,
        encrypted.tag,
      );

      encryptedParts.push(this.codec.bytesToArrayBuffer(encryptedChunk));
      chunks.push({
        iv: this.codec.bytesToBase64(iv),
        size: encryptedChunk.byteLength,
      });
      this.reportProgress(
        'encrypt',
        filename,
        bytes.byteLength,
        index,
        onProgress,
      );
    }

    const firstIv =
      chunks[0]?.iv ?? this.codec.bytesToBase64(new Uint8Array(12));

    return {
      encryptedBytes: this.codec.concatArrayBuffers(encryptedParts),
      encryption: {
        algorithm: 'AES-GCM',
        chunks,
        chunkSize,
        iv: firstIv,
        key: this.codec.bytesToBase64(key),
      },
      id: UUID.generate().toString(),
      type: 'encrypt-result',
      uploadFilename: `${UUID.generate().toString()}.bin`,
    };
  }
}
