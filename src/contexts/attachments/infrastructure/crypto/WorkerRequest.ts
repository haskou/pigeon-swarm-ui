import type { MessageAttachment } from '../../../../shared/domain/pigeonResources.types';

export type WorkerRequest =
  | {
      file: File;
      id: string;
      uploadFilename: string;
      type: 'encrypt';
    }
  | {
      attachment: MessageAttachment;
      encryptedBytes: ArrayBuffer;
      id: string;
      type: 'decrypt';
    };
