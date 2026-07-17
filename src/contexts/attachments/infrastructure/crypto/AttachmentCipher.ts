import { UUID } from '@haskou/value-objects';

import type { MessageAttachment } from '../../application/contracts/MessageAttachment';
import type { AttachmentProgressHandler } from './AttachmentProgressHandler';
import type { AttachmentWorkerFactory } from './AttachmentWorkerFactory';
import type { PendingMessageAttachment } from './resources/PendingMessageAttachment';
import type { WorkerResponse } from './WorkerResponse';

import { AttachmentBinaryCodec } from './AttachmentBinaryCodec';
import { AttachmentCryptographer } from './AttachmentCryptographer';
import { AttachmentWorkerDispatcher } from './AttachmentWorkerDispatcher';

export class AttachmentCipher {
  public static inCurrentThread(): AttachmentCipher {
    const codec = new AttachmentBinaryCodec();

    return new AttachmentCipher(
      new AttachmentWorkerDispatcher(),
      new AttachmentCryptographer(codec),
      codec,
    );
  }

  public static withWorker(
    workerFactory: AttachmentWorkerFactory,
  ): AttachmentCipher {
    const codec = new AttachmentBinaryCodec();

    return new AttachmentCipher(
      new AttachmentWorkerDispatcher(workerFactory),
      new AttachmentCryptographer(codec),
      codec,
    );
  }

  public constructor(
    private readonly workers: AttachmentWorkerDispatcher,
    private readonly cryptographer: AttachmentCryptographer,
    private readonly codec: AttachmentBinaryCodec,
  ) {}

  public async decrypt(
    attachment: MessageAttachment,
    encryptedBytes: ArrayBuffer,
    onProgress?: AttachmentProgressHandler,
  ): Promise<Blob> {
    const result = await this.workers
      .run<Extract<WorkerResponse, { type: 'decrypt-result' }>>(
        {
          attachment,
          encryptedBytes,
          id: UUID.generate().toString(),
          type: 'decrypt',
        },
        onProgress,
      )
      .catch(() =>
        this.cryptographer.decrypt(attachment, encryptedBytes, onProgress),
      );

    return new Blob([result.bytes], { type: attachment.contentType });
  }

  public async encrypt(
    file: File,
    onProgress?: AttachmentProgressHandler,
  ): Promise<PendingMessageAttachment> {
    const result = await this.workers
      .run<Extract<WorkerResponse, { type: 'encrypt-result' }>>(
        {
          file,
          id: UUID.generate().toString(),
          type: 'encrypt',
          uploadFilename: `${UUID.generate().toString()}.bin`,
        },
        onProgress,
      )
      .catch(async () =>
        this.cryptographer.encrypt(
          file.name || 'attachment',
          await file.arrayBuffer(),
          onProgress,
        ),
      );

    return {
      encryptedBytes: result.encryptedBytes,
      metadata: {
        contentType: file.type || 'application/octet-stream',
        encryption: result.encryption,
        filename: file.name || 'attachment',
        size: file.size,
      },
      uploadFilename: result.uploadFilename,
    };
  }

  public async encryptWithoutWorker(
    file: File,
    onProgress?: AttachmentProgressHandler,
  ): Promise<Extract<WorkerResponse, { type: 'encrypt-result' }>> {
    return this.cryptographer.encrypt(
      file.name || 'attachment',
      await file.arrayBuffer(),
      onProgress,
    );
  }

  public decryptWithoutWorker(
    attachment: MessageAttachment,
    encryptedBytes: ArrayBuffer,
    onProgress?: AttachmentProgressHandler,
  ): Extract<WorkerResponse, { type: 'decrypt-result' }> {
    return this.cryptographer.decrypt(attachment, encryptedBytes, onProgress);
  }

  public base64ToArrayBuffer(value: string): ArrayBuffer {
    return this.codec.base64ToArrayBuffer(value);
  }

  public base64ToBytes(value: string): Uint8Array {
    return this.codec.base64ToBytes(value);
  }

  public bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    return this.codec.bytesToArrayBuffer(bytes);
  }
}
