import type { PrivateBlobReference } from '../../application/contracts/PrivateBlobReservation';

export type EncryptedAttachmentUpload = {
  blobs: PrivateBlobReference[];
  size: number;
  type?: 'chunked_file';
};
