import {
  SymmetricEncryptedPayload,
  SymmetricKey,
} from '@haskou/pigeon-swarm-crypto';
import { UUID } from '@haskou/value-objects';
import { Buffer } from 'buffer';

import type { MessageAttachment } from '../../application/contracts/MessageAttachment';
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

    const key = SymmetricKey.fromBase64(attachment.encryption.key);
    const chunks = attachment.encryption.chunks ?? [
      { iv: attachment.encryption.iv, size: encryptedBytes.byteLength },
    ];
    const decryptedParts: ArrayBuffer[] = [];
    let offset = 0;

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const encryptedChunk = encryptedBytes.slice(offset, offset + chunk.size);
      const encryptedChunkBytes = new Uint8Array(encryptedChunk);
      const payload = new SymmetricEncryptedPayload(
        [
          'v1',
          'aes-256-gcm',
          chunk.iv,
          this.codec.bytesToBase64(
            encryptedChunkBytes.subarray(0, -gcmTagBytes),
          ),
          this.codec.bytesToBase64(encryptedChunkBytes.subarray(-gcmTagBytes)),
        ].join('.'),
      );
      const decrypted = key.decrypt(payload, { aad: '' });

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
    const key = SymmetricKey.generate();
    const encryptedParts: ArrayBuffer[] = [];
    const chunks: { iv: string; size: number }[] = [];
    const totalChunks = Math.ceil(bytes.byteLength / chunkSize) || 1;

    for (let index = 0; index < totalChunks; index += 1) {
      const offset = index * chunkSize;
      const chunk = bytes.slice(
        offset,
        Math.min(offset + chunkSize, bytes.byteLength),
      );
      const encrypted = key.encrypt(Buffer.from(chunk), { aad: '' });
      const [, , iv, ciphertext, tag] = encrypted.valueOf().split('.');
      const encryptedChunk = this.codec.concatBytes(
        this.codec.base64ToBytes(ciphertext),
        this.codec.base64ToBytes(tag),
      );

      encryptedParts.push(this.codec.bytesToArrayBuffer(encryptedChunk));
      chunks.push({
        iv,
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
        key: key.valueOf(),
      },
      id: UUID.generate().toString(),
      type: 'encrypt-result',
      uploadFilename: `${UUID.generate().toString()}.bin`,
    };
  }
}
