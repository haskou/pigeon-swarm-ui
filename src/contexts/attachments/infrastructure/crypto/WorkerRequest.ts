import type { MessageAttachment } from '../../application/contracts/MessageAttachment';

export type WorkerRequest =
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
