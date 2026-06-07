import type { MessageAttachment } from './MessageAttachment';

export type PendingMessageAttachment = {
  encryptedBytes: ArrayBuffer;
  metadata: Omit<MessageAttachment, 'cid' | 'encryptedSize'>;
  uploadFilename: string;
};
