import type { PublicFileContent } from '../../../../shared/domain/pigeonResources.types';

export interface GetPublicFilePort {
  getPublicFile(cid: string): Promise<PublicFileContent>;
}
