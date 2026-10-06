import type {
  PrivateFileContent,
  PrivateFileUpload,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { PigeonContentReplicationClient } from './PigeonContentReplicationClient';

export class PigeonPrivateFilesClient {
  public constructor(
    private readonly http: Pick<HttpJsonClient, 'request'>,
    private readonly signer: Pick<RequestSigner, 'headers'>,
    private readonly replication: Pick<
      PigeonContentReplicationClient,
      'register'
    >,
  ) {}

  public async fetch(cid: string): Promise<PrivateFileContent> {
    return await this.http.request<PrivateFileContent>(
      `/ipfs/${encodeURIComponent(cid)}`,
    );
  }

  public async upload(
    session: Session,
    networkId: string,
    bytes: ArrayBuffer,
    filename: string,
  ): Promise<PrivateFileUpload> {
    const path = `/ipfs/${encodeURIComponent(networkId)}`;

    const upload = await this.http.request<PrivateFileUpload>(path, {
      body: bytes,
      headers: {
        ...(await this.signer.headers(session, 'POST', path, bytes)),
        'Content-Type': 'application/octet-stream',
        'X-Filename': filename,
      },
      method: 'POST',
    });

    await this.replication.register(session, {
      cid: upload.cid,
      context: 'ipfs_private_upload',
      networkId,
      sizeBytes: bytes.byteLength,
    });

    return upload;
  }
}
