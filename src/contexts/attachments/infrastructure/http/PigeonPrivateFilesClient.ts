import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { PrivateFileContent } from '../../application/contracts/PrivateFileContent';

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
