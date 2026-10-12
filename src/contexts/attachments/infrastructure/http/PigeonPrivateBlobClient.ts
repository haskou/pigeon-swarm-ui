import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type {
  PrivateBlobReference,
  PrivateBlobReservation,
} from '../../application/contracts/PrivateBlobReservation';

import { MailboxHomeBase } from '../../../../shared/infrastructure/client/MailboxHomeBase';
import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';
import { PrivateBlobUnavailableError } from './PrivateBlobUnavailableError';

const reservationPath = '/private-blobs';

export class PigeonPrivateBlobClient {
  public constructor(
    private readonly http: Pick<HttpJsonClient, 'request' | 'requestBlob'>,
    private readonly signer: Pick<RequestSigner, 'headers'>,
    private readonly origins: {
      /** Session node base, or undefined when not publishable. */
      home: () => string | undefined;
      /** Client bound to one node base, isolated from ambient credentials. */
      client: (origin: string) => Pick<HttpJsonClient, 'requestBlob'>;
    },
  ) {}

  /** Node answers unknown, expired or mismatched capabilities with 404. */
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
    const reservation = await this.http.request<
      Omit<PrivateBlobReservation, 'origin'>
    >(reservationPath, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(
        session,
        'POST',
        reservationPath,
        body,
      ),
      method: 'POST',
    });
    const home = this.origins.home();

    return home ? { ...reservation, origin: home } : reservation;
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

  /**
   * Reads the part from its origin. An origin that fails the canonical rule is
   * ignored and the session node is used instead, so it is never fetched.
   * No Range header is sent, so the node answers only with 200.
   */
  public async download(
    reference: Pick<
      PrivateBlobReference,
      'blobId' | 'downloadToken' | 'origin' | 'size'
    >,
  ): Promise<ArrayBuffer> {
    const origin = MailboxHomeBase.parse(reference.origin);
    const source = origin ? this.origins.client(origin) : this.http;
    const blob = await this.unavailableWhenNotFound(
      source.requestBlob(
        `${reservationPath}/${encodeURIComponent(reference.blobId)}`,
        {
          headers: { Authorization: `Bearer ${reference.downloadToken}` },
          redirect: 'error',
        },
      ),
    );

    if (blob.size !== reference.size) {
      throw new PrivateBlobUnavailableError();
    }

    return await blob.arrayBuffer();
  }
}
