import type { MessageAttachmentEncryption } from './MessageAttachmentEncryption';
import type { PrivateBlobReference } from './PrivateBlobReservation';

export type MessageAttachment = {
  /** Public IPFS CID. Encrypted attachments use blobs instead. */
  cid?: string;
  /** Encrypted parts stored in node private blobs, ordered by index. */
  blobs?: PrivateBlobReference[];
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
