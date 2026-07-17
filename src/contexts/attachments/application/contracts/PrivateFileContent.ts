import type { PrivateFileUpload } from './PrivateFileUpload';

export type PrivateFileContent = PrivateFileUpload & {
  encryptedData: string;
  uploadedAt?: number | string;
  uploadedByIdentityId?: string;
};
