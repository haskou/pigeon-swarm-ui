import { UUID } from '@haskou/value-objects';
import { CryptoAdapter } from '@haskou/value-objects/dist/value-objects/crypto/CryptoAdapter';

import type {
  AttachmentProgress,
  MessageAttachment,
  PendingMessageAttachment,
} from '../../../../shared/domain/pigeonResources.types';
import type { AttachmentProgressHandler } from './AttachmentProgressHandler';
import type { AttachmentWorkerFactory } from './AttachmentWorkerFactory';
import type { WorkerRequest } from './WorkerRequest';
import type { WorkerResponse } from './WorkerResponse';

const chunkSize = 8 * 1024 * 1024;
const gcmTagBytes = 16;
const largeAttachmentBytes = 5 * 1024 * 1024;

export class AttachmentCipher {
  private nextWorkerRequestId = 0;

  private readonly workerRequests = new Map<
    string,
    {
      onProgress?: AttachmentProgressHandler;
      reject: (reason?: unknown) => void;
      resolve: (response: WorkerResponse) => void;
    }
  >();

  private worker?: Worker;

  public constructor(
    private readonly workerFactory?: AttachmentWorkerFactory,
  ) {}

  private async encryptInCurrentThread(
    file: File,
    onProgress?: AttachmentProgressHandler,
  ): Promise<Extract<WorkerResponse, { type: 'encrypt-result' }>> {
    const bytes = await file.arrayBuffer();

    return this.encryptBytes(file.name || 'attachment', bytes, onProgress);
  }

  private decryptInCurrentThread(
    attachment: MessageAttachment,
    encryptedBytes: ArrayBuffer,
    onProgress?: AttachmentProgressHandler,
  ): Extract<WorkerResponse, { type: 'decrypt-result' }> {
    return {
      bytes: this.decryptBytes(attachment, encryptedBytes, onProgress),
      id: UUID.generate().toString(),
      type: 'decrypt-result',
    };
  }

  private encryptBytes(
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
      const encryptedChunk = this.concatBytes(
        encrypted.cipherText,
        encrypted.tag,
      );

      encryptedParts.push(this.bytesToArrayBuffer(encryptedChunk));
      chunks.push({
        iv: this.bytesToBase64(iv),
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

    const firstIv = chunks[0]?.iv ?? this.bytesToBase64(new Uint8Array(12));

    return {
      encryptedBytes: this.concatArrayBuffers(encryptedParts),
      encryption: {
        algorithm: 'AES-GCM',
        chunks,
        chunkSize,
        iv: firstIv,
        key: this.bytesToBase64(key),
      },
      id: UUID.generate().toString(),
      type: 'encrypt-result',
      uploadFilename: `${UUID.generate().toString()}.bin`,
    };
  }

  private decryptBytes(
    attachment: MessageAttachment,
    encryptedBytes: ArrayBuffer,
    onProgress?: AttachmentProgressHandler,
  ): ArrayBuffer {
    if (!attachment.encryption) {
      throw new Error('Attachment is not encrypted.');
    }

    const key = this.base64ToBytes(attachment.encryption.key);
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
        this.base64ToBytes(chunk.iv),
        encryptedChunkBytes.subarray(0, -gcmTagBytes),
        encryptedChunkBytes.subarray(-gcmTagBytes),
      );

      decryptedParts.push(this.bytesToArrayBuffer(decrypted));
      offset += chunk.size;
      this.reportProgress(
        'decrypt',
        attachment.filename,
        attachment.size,
        index,
        onProgress,
      );
    }

    return this.concatArrayBuffers(decryptedParts);
  }

  private reportProgress(
    phase: AttachmentProgress['phase'],
    filename: string,
    size: number,
    index: number,
    onProgress?: AttachmentProgressHandler,
  ) {
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

  private runWorker<T extends WorkerResponse>(
    request: WorkerRequest,
    onProgress?: AttachmentProgressHandler,
  ): Promise<T> {
    if (typeof Worker === 'undefined') {
      return Promise.reject(new Error('Attachment workers are not available'));
    }

    const worker = this.attachmentWorker();
    const id = `${this.nextWorkerRequestId + 1}`;

    this.nextWorkerRequestId += 1;

    return new Promise<T>((resolve, reject) => {
      this.workerRequests.set(id, {
        onProgress,
        reject,
        resolve: (response) => resolve(response as T),
      });

      try {
        worker.postMessage({ ...request, id });
      } catch (caught) {
        this.workerRequests.delete(id);
        reject(caught);
      }
    });
  }

  private attachmentWorker(): Worker {
    if (this.worker) return this.worker;

    if (!this.workerFactory) {
      throw new Error('Attachment workers are not available');
    }

    this.worker = this.workerFactory();
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      this.handleWorkerMessage(event.data);
    };
    this.worker.onerror = (event) => {
      const error = new Error(event.message);

      for (const pending of this.workerRequests.values()) {
        pending.reject(error);
      }

      this.workerRequests.clear();
      this.worker?.terminate();
      this.worker = undefined;
    };

    return this.worker;
  }

  private handleWorkerMessage(response: WorkerResponse): void {
    const pending = this.workerRequests.get(response.id);

    if (!pending) return;

    if (response.type === 'progress') {
      pending.onProgress?.(response.progress);

      return;
    }

    this.workerRequests.delete(response.id);

    if (response.type === 'error') {
      pending.reject(new Error(response.error));

      return;
    }

    pending.resolve(response);
  }

  private concatArrayBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
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

  private concatBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
    const output = new Uint8Array(left.byteLength + right.byteLength);

    output.set(left);
    output.set(right, left.byteLength);

    return output;
  }

  private bytesToBase64(bytes: Uint8Array): string {
    let binary = '';

    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    return btoa(binary);
  }

  public async encrypt(
    file: File,
    onProgress?: AttachmentProgressHandler,
  ): Promise<PendingMessageAttachment> {
    const result = await this.runWorker<
      Extract<WorkerResponse, { type: 'encrypt-result' }>
    >(
      {
        file,
        id: UUID.generate().toString(),
        type: 'encrypt',
        uploadFilename: `${UUID.generate().toString()}.bin`,
      },
      onProgress,
    ).catch(() => this.encryptInCurrentThread(file, onProgress));

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

  public async decrypt(
    attachment: MessageAttachment,
    encryptedBytes: ArrayBuffer,
    onProgress?: AttachmentProgressHandler,
  ): Promise<Blob> {
    const result = await this.runWorker<
      Extract<WorkerResponse, { type: 'decrypt-result' }>
    >(
      {
        attachment,
        encryptedBytes,
        id: UUID.generate().toString(),
        type: 'decrypt',
      },
      onProgress,
    ).catch(() =>
      this.decryptInCurrentThread(attachment, encryptedBytes, onProgress),
    );

    return new Blob([result.bytes], { type: attachment.contentType });
  }

  public async encryptWithoutWorker(
    file: File,
    onProgress?: AttachmentProgressHandler,
  ): Promise<Extract<WorkerResponse, { type: 'encrypt-result' }>> {
    return await this.encryptInCurrentThread(file, onProgress);
  }

  public decryptWithoutWorker(
    attachment: MessageAttachment,
    encryptedBytes: ArrayBuffer,
    onProgress?: AttachmentProgressHandler,
  ): Extract<WorkerResponse, { type: 'decrypt-result' }> {
    return this.decryptInCurrentThread(attachment, encryptedBytes, onProgress);
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
}
