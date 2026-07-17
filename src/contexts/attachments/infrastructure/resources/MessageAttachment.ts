import type { MessageAttachmentEncryption } from './MessageAttachmentEncryption';

export type MessageAttachment = {
  cid: string;
  chunks?: Array<{
    cid: string;
    index: number;
    sha256: string;
    size: number;
  }>;
  contentType: string;
  encrypted?: boolean;
  encryptedSize?: number;
  encryption?: MessageAttachmentEncryption;
  filename: string;
  localFile?: File;
  preview?: MessageAttachment;
  size: number;
  storage?: 'private' | 'public';
  type?: 'chunked_file';
};
