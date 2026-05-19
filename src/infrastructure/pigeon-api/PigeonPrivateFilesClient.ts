import type {
  PrivateFileContent,
  PrivateFileUpload,
  Session,
} from '../../domain/types';
import type { HttpJsonClient } from '../http/HttpJsonClient';
import type { RequestSigner } from './RequestSigner';

export class PigeonPrivateFilesClient {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
  ) {}

  public async fetch(cid: string): Promise<PrivateFileContent> {
    return await this.http.request<PrivateFileContent>(
      `/ipfs/${encodeURIComponent(cid)}`,
    );
  }

  public async upload(
    session: Session,
    bytes: ArrayBuffer,
    filename: string,
  ): Promise<PrivateFileUpload> {
    const path = '/ipfs/private';

    return await this.http.request<PrivateFileUpload>(path, {
      body: bytes,
      headers: {
        ...(await this.signer.headers(session, 'POST', path, bytes)),
        'Content-Type': 'application/octet-stream',
        'X-Filename': filename,
      },
      method: 'POST',
    });
  }
}
