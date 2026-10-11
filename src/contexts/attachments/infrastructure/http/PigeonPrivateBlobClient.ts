import type { PrivateBlobReservation } from '../../application/contracts/PrivateBlobReservation';
import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';

import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';

export class PrivateBlobUnavailableError extends Error {
  public constructor() {
    super('Private blob is unavailable.');
    this.name = PrivateBlobUnavailableError.name;
  }
}

const reservationPath = '/private-blobs';

export class PigeonPrivateBlobClient {
  public constructor(
    private readonly http: Pick<HttpJsonClient, 'request' | 'requestBlob'>,
    private readonly signer: Pick<RequestSigner, 'headers'>,
  ) {}

  /** The node answers every unknown, expired or wrong-capability request with 404. */
  private async unavailableWhenNotFound<T>(operation: Promise<T>): Promise<T> {
    try {
      return await operation;
    } catch (error) {
      if (error instanceof HttpJsonError && error.status === 404) {
        throw new PrivateBlobUnavailableError();
      }

      throw error;
    }
  }

  public async reserve(
    session: Session,
    size: number,
  ): Promise<PrivateBlobReservation> {
    const body = { size };

    return await this.http.request<PrivateBlobReservation>(reservationPath, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(
        session,
        'POST',
        reservationPath,
        body,
      ),
      method: 'POST',
    });
  }

  public async upload(
    capability: Pick<PrivateBlobReservation, 'blobId' | 'uploadToken'>,
    bytes: ArrayBuffer,
  ): Promise<void> {
    await this.unavailableWhenNotFound(
      this.http.request<void>(
        `${reservationPath}/${encodeURIComponent(capability.blobId)}`,
        {
          body: bytes,
          headers: {
            Authorization: `Bearer ${capability.uploadToken}`,
            'Content-Type': 'application/octet-stream',
          },
          method: 'PUT',
        },
      ),
    );
  }

  public async download(
    capability: Pick<PrivateBlobReservation, 'blobId' | 'downloadToken'>,
  ): Promise<ArrayBuffer> {
    const blob = await this.unavailableWhenNotFound(
      this.http.requestBlob(
        `${reservationPath}/${encodeURIComponent(capability.blobId)}`,
        {
          headers: { Authorization: `Bearer ${capability.downloadToken}` },
        },
      ),
    );

    return await blob.arrayBuffer();
  }
}
