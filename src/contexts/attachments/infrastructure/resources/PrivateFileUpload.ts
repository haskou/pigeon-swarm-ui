import type { PublicFileUpload } from './PublicFileUpload';

export type PrivateFileUpload = PublicFileUpload & {
  encrypted: true;
};
