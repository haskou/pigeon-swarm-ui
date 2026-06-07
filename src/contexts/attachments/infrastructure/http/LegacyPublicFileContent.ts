import type { PublicFileUpload } from '../../../../shared/domain/pigeonResources.types';

export type LegacyPublicFileContent = PublicFileUpload & {
  data: string;
  uploadedAt?: string;
  uploadedByIdentityId?: string;
};
