import type {
  AttachmentProgress,
  MessageAttachment,
  MessageAttachmentEncryption,
  PendingMessageAttachment,
} from '../types';

const chunkSize = 1024 * 1024;
const largeAttachmentBytes = 5 * 1024 * 1024;

type AttachmentProgressHandler = (progress: AttachmentProgress) => void;

type WorkerRequest =
  | {
      file: File;
      id: string;
      type: 'encrypt';
    }
  | {
      attachment: MessageAttachment;
      encryptedBytes: ArrayBuffer;
      id: string;
      type: 'decrypt';
    };

type WorkerResponse =
  | {
      id: string;
      progress: AttachmentProgress;
      type: 'progress';
    }
  | {
      encryptedBytes: ArrayBuffer;
      encryption: MessageAttachmentEncryption;
      id: string;
      type: 'encrypt-result';
      uploadFilename: string;
    }
  | {
      bytes: ArrayBuffer;
      id: string;
      type: 'decrypt-result';
    }
  | {
      error: string;
      id: string;
      type: 'error';
    };

export class AttachmentCipher {
  private workerUrl?: string;

  public async encrypt(
    file: File,
    onProgress?: AttachmentProgressHandler,
  ): Promise<PendingMessageAttachment> {
    const result = await this.runWorker<
      Extract<WorkerResponse, { type: 'encrypt-result' }>
    >({ file, id: crypto.randomUUID(), type: 'encrypt' }, onProgress).catch(
      () => this.encryptInCurrentThread(file, onProgress),
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
        id: crypto.randomUUID(),
        type: 'decrypt',
      },
      onProgress,
    ).catch(() =>
      this.decryptInCurrentThread(attachment, encryptedBytes, onProgress),
    );

    return new Blob([result.bytes], { type: attachment.contentType });
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

  private async encryptInCurrentThread(
    file: File,
    onProgress?: AttachmentProgressHandler,
  ): Promise<Extract<WorkerResponse, { type: 'encrypt-result' }>> {
    const bytes = await file.arrayBuffer();

    return this.encryptBytes(file.name || 'attachment', bytes, onProgress);
  }

  private async decryptInCurrentThread(
    attachment: MessageAttachment,
    encryptedBytes: ArrayBuffer,
    onProgress?: AttachmentProgressHandler,
  ): Promise<Extract<WorkerResponse, { type: 'decrypt-result' }>> {
    return {
      bytes: await this.decryptBytes(attachment, encryptedBytes, onProgress),
      id: crypto.randomUUID(),
      type: 'decrypt-result',
    };
  }

  private async encryptBytes(
    filename: string,
    bytes: ArrayBuffer,
    onProgress?: AttachmentProgressHandler,
  ): Promise<Extract<WorkerResponse, { type: 'encrypt-result' }>> {
    const key = await crypto.subtle.generateKey(
      { length: 256, name: 'AES-GCM' },
      true,
      ['decrypt', 'encrypt'],
    );
    const rawKey = await crypto.subtle.exportKey('raw', key);
    const encryptedParts: ArrayBuffer[] = [];
    const chunks: { iv: string; size: number }[] = [];
    const totalChunks = Math.ceil(bytes.byteLength / chunkSize) || 1;

    for (let index = 0; index < totalChunks; index += 1) {
      const offset = index * chunkSize;
      const chunk = bytes.slice(
        offset,
        Math.min(offset + chunkSize, bytes.byteLength),
      );
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { iv, name: 'AES-GCM' },
        key,
        chunk,
      );

      encryptedParts.push(encrypted);
      chunks.push({ iv: this.bytesToBase64(iv), size: encrypted.byteLength });
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
        key: this.bytesToBase64(new Uint8Array(rawKey)),
      },
      id: crypto.randomUUID(),
      type: 'encrypt-result',
      uploadFilename: `${crypto.randomUUID()}.bin`,
    };
  }

  private async decryptBytes(
    attachment: MessageAttachment,
    encryptedBytes: ArrayBuffer,
    onProgress?: AttachmentProgressHandler,
  ): Promise<ArrayBuffer> {
    const key = await crypto.subtle.importKey(
      'raw',
      this.base64ToArrayBuffer(attachment.encryption.key),
      { name: 'AES-GCM' },
      false,
      ['decrypt'],
    );
    const chunks = attachment.encryption.chunks ?? [
      { iv: attachment.encryption.iv, size: encryptedBytes.byteLength },
    ];
    const decryptedParts: ArrayBuffer[] = [];
    let offset = 0;

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const encryptedChunk = encryptedBytes.slice(offset, offset + chunk.size);
      const decrypted = await crypto.subtle.decrypt(
        {
          iv: this.base64ToArrayBuffer(chunk.iv),
          name: attachment.encryption.algorithm,
        },
        key,
        encryptedChunk,
      );

      decryptedParts.push(decrypted);
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

  private async runWorker<T extends WorkerResponse>(
    request: WorkerRequest,
    onProgress?: AttachmentProgressHandler,
  ): Promise<T> {
    if (typeof Worker === 'undefined' || typeof Blob === 'undefined') {
      throw new Error('Workers are not available');
    }

    const worker = new Worker(this.workerObjectUrl());

    return await new Promise<T>((resolve, reject) => {
      worker.addEventListener(
        'message',
        (event: MessageEvent<WorkerResponse>) => {
          const message = event.data;

          if (message.id !== request.id) return;

          if (message.type === 'progress') {
            onProgress?.(message.progress);

            return;
          }

          worker.terminate();

          if (message.type === 'error') reject(new Error(message.error));
          else resolve(message as T);
        },
      );
      worker.addEventListener('error', (event) => {
        worker.terminate();
        reject(event.error ?? new Error(event.message));
      });
      worker.postMessage(request);
    });
  }

  private workerObjectUrl(): string {
    if (this.workerUrl) return this.workerUrl;

    this.workerUrl = URL.createObjectURL(
      new Blob([this.workerSource()], { type: 'text/javascript' }),
    );

    return this.workerUrl;
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

  private bytesToBase64(bytes: Uint8Array): string {
    let binary = '';

    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    return btoa(binary);
  }

  private workerSource(): string {
    return `
const chunkSize = ${chunkSize};
const largeAttachmentBytes = ${largeAttachmentBytes};
const bytesToBase64 = (bytes) => {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
};
const base64ToBytes = (value) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};
const concatArrayBuffers = (buffers) => {
  const totalSize = buffers.reduce((total, buffer) => total + buffer.byteLength, 0);
  const output = new Uint8Array(totalSize);
  let offset = 0;
  buffers.forEach((buffer) => {
    output.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  });
  return output.buffer;
};
const reportProgress = (id, phase, filename, size, index) => {
  if (size < largeAttachmentBytes) return;
  self.postMessage({
    id,
    progress: {
      filename,
      percent: Math.min(100, Math.round(((index + 1) * chunkSize * 100) / size)),
      phase,
    },
    type: 'progress',
  });
};
const encryptFile = async (message) => {
  const filename = message.file.name || 'attachment';
  const bytes = await message.file.arrayBuffer();
  const key = await crypto.subtle.generateKey(
    { length: 256, name: 'AES-GCM' },
    true,
    ['decrypt', 'encrypt'],
  );
  const rawKey = await crypto.subtle.exportKey('raw', key);
  const encryptedParts = [];
  const chunks = [];
  const totalChunks = Math.ceil(bytes.byteLength / chunkSize) || 1;
  for (let index = 0; index < totalChunks; index += 1) {
    const offset = index * chunkSize;
    const chunk = bytes.slice(offset, Math.min(offset + chunkSize, bytes.byteLength));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ iv, name: 'AES-GCM' }, key, chunk);
    encryptedParts.push(encrypted);
    chunks.push({ iv: bytesToBase64(iv), size: encrypted.byteLength });
    reportProgress(message.id, 'encrypt', filename, bytes.byteLength, index);
  }
  const firstIv = chunks[0]?.iv ?? bytesToBase64(new Uint8Array(12));
  self.postMessage({
    encryptedBytes: concatArrayBuffers(encryptedParts),
    encryption: {
      algorithm: 'AES-GCM',
      chunkSize: chunkSize,
      chunks,
      iv: firstIv,
      key: bytesToBase64(new Uint8Array(rawKey)),
    },
    id: message.id,
    type: 'encrypt-result',
    uploadFilename: crypto.randomUUID() + '.bin',
  });
};
const decryptAttachment = async (message) => {
  const key = await crypto.subtle.importKey(
    'raw',
    base64ToBytes(message.attachment.encryption.key),
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );
  const chunks = message.attachment.encryption.chunks ?? [
    { iv: message.attachment.encryption.iv, size: message.encryptedBytes.byteLength },
  ];
  const decryptedParts = [];
  let offset = 0;
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const encryptedChunk = message.encryptedBytes.slice(offset, offset + chunk.size);
    const decrypted = await crypto.subtle.decrypt(
      { iv: base64ToBytes(chunk.iv), name: message.attachment.encryption.algorithm },
      key,
      encryptedChunk,
    );
    decryptedParts.push(decrypted);
    offset += chunk.size;
    reportProgress(message.id, 'decrypt', message.attachment.filename, message.attachment.size, index);
  }
  self.postMessage({
    bytes: concatArrayBuffers(decryptedParts),
    id: message.id,
    type: 'decrypt-result',
  });
};
self.addEventListener('message', (event) => {
  const message = event.data;
  const action = message.type === 'encrypt' ? encryptFile : decryptAttachment;
  action(message).catch((error) => {
    self.postMessage({
      error: error instanceof Error ? error.message : 'Attachment crypto failed',
      id: message.id,
      type: 'error',
    });
  });
});
`;
  }
}
