export type PublicFileUpload = {
  cid: string;
  contentType: string;
  filename: string;
  size: number;
};

export type PublicFileContent = PublicFileUpload & {
  blob: Blob;
  uploadedAt?: string;
  uploadedByIdentityId?: string;
};

export type PrivateFileUpload = PublicFileUpload & {
  encrypted: true;
};

export type PrivateFileContent = PrivateFileUpload & {
  encryptedData: string;
  uploadedAt?: number | string;
  uploadedByIdentityId?: string;
};

export type MessageAttachmentEncryption = {
  algorithm: 'AES-GCM';
  chunks?: { iv: string; size: number }[];
  chunkSize?: number;
  iv: string;
  key: string;
};

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

export type PendingMessageAttachment = {
  encryptedBytes: ArrayBuffer;
  metadata: Omit<MessageAttachment, 'cid' | 'encryptedSize'>;
  uploadFilename: string;
};

export type AttachmentProgress = {
  filename: string;
  percent: number;
  phase: 'decrypt' | 'download' | 'encrypt' | 'upload';
};

export type AttachmentUploadOptions = {
  encryptLargeAttachments?: boolean;
  encryptSmallAttachments?: boolean;
};
