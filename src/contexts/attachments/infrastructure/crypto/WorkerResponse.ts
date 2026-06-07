import type {
  AttachmentProgress,
  MessageAttachmentEncryption,
} from '../../../../shared/domain/pigeonResources.types';

export type WorkerResponse =
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
