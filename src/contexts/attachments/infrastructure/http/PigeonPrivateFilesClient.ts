import type { PrivateFileContent } from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';

/**
 * Reads encrypted content published to private IPFS before private blobs.
 * New encrypted attachments are never written here.
 */
export class PigeonPrivateFilesClient {
  public constructor(private readonly http: Pick<HttpJsonClient, 'request'>) {}

  public async fetch(cid: string): Promise<PrivateFileContent> {
    return await this.http.request<PrivateFileContent>(
      `/ipfs/${encodeURIComponent(cid)}`,
    );
  }
}
