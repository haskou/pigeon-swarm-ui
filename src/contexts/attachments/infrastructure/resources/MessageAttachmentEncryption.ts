export type MessageAttachmentEncryption = {
  algorithm: 'AES-GCM';
  chunks?: { iv: string; size: number }[];
  chunkSize?: number;
  iv: string;
  key: string;
};
