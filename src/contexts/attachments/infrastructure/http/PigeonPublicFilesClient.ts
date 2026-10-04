import type {
  PublicFileContent,
  PublicFileUpload,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';

export class PigeonPublicFilesClient {
  public constructor(
    private readonly http: Pick<HttpJsonClient, 'request' | 'requestBlob'>,
    private readonly signer: Pick<RequestSigner, 'headers'>,
  ) {}

  private content(cid: string, blob: Blob): PublicFileContent {
    return {
      blob,
      cid,
      contentType: blob.type || 'application/octet-stream',
      filename: cid,
      size: blob.size,
    };
  }

  public async fetch(
    cid: string,
    onDownloadProgress?: (percent: number) => void,
  ): Promise<PublicFileContent> {
    const blob = await this.http.requestBlob(
      `/ipfs/${encodeURIComponent(cid)}`,
      {
        ...(onDownloadProgress
          ? {
              onDownloadProgress: ({ loadedBytes, totalBytes }) => {
                if (!totalBytes) return;

                onDownloadProgress((loadedBytes * 100) / totalBytes);
              },
            }
          : {}),
      },
    );

    return this.content(cid, blob);
  }

  public async upload(
    session: Session,
    bytes: ArrayBuffer,
    filename: string,
    contentType = 'application/octet-stream',
  ): Promise<PublicFileUpload> {
    const path = '/ipfs/public';

    return await this.http.request<PublicFileUpload>(path, {
      body: bytes,
      headers: {
        ...(await this.signer.headers(session, 'POST', path, bytes)),
        'Content-Type': contentType,
        'X-Filename': filename,
      },
      method: 'POST',
    });
  }
}
