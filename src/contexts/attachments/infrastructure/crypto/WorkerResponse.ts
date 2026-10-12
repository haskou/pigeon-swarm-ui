import type { AttachmentProgress } from '../../application/contracts/AttachmentProgress';
import type { MessageAttachmentEncryption } from '../../application/contracts/MessageAttachmentEncryption';

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
