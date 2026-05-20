import { Buffer } from 'buffer';

import type {
  PublicFileContent,
  PublicFileUpload,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/httpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/requestSigner';

type LegacyPublicFileContent = PublicFileUpload & {
  data: string;
  uploadedAt?: string;
  uploadedByIdentityId?: string;
};

export class PigeonPublicFilesClient {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
  ) {}

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

    return await this.content(cid, blob);
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

  private async content(cid: string, blob: Blob): Promise<PublicFileContent> {
    if (blob.type.includes('json')) {
      return this.legacyContent(await blob.text());
    }

    return {
      blob,
      cid,
      contentType: blob.type || 'application/octet-stream',
      filename: cid,
      size: blob.size,
    };
  }

  private legacyContent(payload: string): PublicFileContent {
    const content = JSON.parse(payload) as LegacyPublicFileContent;
    const bytes = Uint8Array.from(Buffer.from(content.data, 'base64'));

    return {
      blob: new Blob([bytes], { type: content.contentType }),
      cid: content.cid,
      contentType: content.contentType,
      filename: content.filename,
      size: content.size,
      uploadedAt: content.uploadedAt,
      uploadedByIdentityId: content.uploadedByIdentityId,
    };
  }
}
