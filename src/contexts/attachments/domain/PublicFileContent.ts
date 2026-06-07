import type { PublicFileUpload } from './PublicFileUpload';

export type PublicFileContent = PublicFileUpload & {
  blob: Blob;
  uploadedAt?: string;
  uploadedByIdentityId?: string;
};
