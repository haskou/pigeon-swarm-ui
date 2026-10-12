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

/** Upper bound on one private blob download, response body included. */
export const privateBlobDownloadTimeoutMs = 60_000;

export class PigeonPrivateBlobClient {
  public constructor(
    private readonly http: Pick<HttpJsonClient, 'request' | 'requestBlob'>,
    private readonly signer: Pick<RequestSigner, 'headers'>,
    private readonly origins: {
      /** Session node base, or undefined when not publishable. */
      home: () => string | undefined;
      /** Client bound to one node base, isolated from ambient credentials. */
      client: (
        origin: string,
      ) => Pick<HttpJsonClient, 'request' | 'requestBlob'>;
      /** Signer bound to one node base, isolated from ambient credentials. */
      signer: (origin: string) => Pick<RequestSigner, 'headers'>;
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

  /**
   * Canonical origin of a node other than the session node, or undefined when
   * the session node serves it. A non-canonical origin is refused without
   * being echoed back in the error.
   */
  private foreignOrigin(origin: string | undefined): string | undefined {
    if (origin === undefined || origin === this.origins.home()) {
      return undefined;
    }

    const canonical = MailboxHomeBase.parse(origin);

    if (!canonical) {
      throw new Error('Private blob origin is not canonical');
    }

    return canonical;
  }

  public async reserve(
    session: Session,
    size: number,
    origin?: string,
  ): Promise<PrivateBlobReservation> {
    const body = { size };
    const foreign = this.foreignOrigin(origin);
    const client = foreign ? this.origins.client(foreign) : this.http;
    const signer = foreign ? this.origins.signer(foreign) : this.signer;
    const reservation = await client.request<
      Omit<PrivateBlobReservation, 'origin'>
    >(reservationPath, {
      body: JSON.stringify(body),
      headers: await signer.headers(session, 'POST', reservationPath, body),
      method: 'POST',
    });
    const stamp = foreign ?? this.origins.home();

    return stamp ? { ...reservation, origin: stamp } : reservation;
  }

  public async upload(
    capability: Pick<
      PrivateBlobReservation,
      'blobId' | 'origin' | 'uploadToken'
    >,
    bytes: ArrayBuffer,
  ): Promise<void> {
    const foreign = this.foreignOrigin(capability.origin);
    const client = foreign ? this.origins.client(foreign) : this.http;

    await this.unavailableWhenNotFound(
      client.request<void>(
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

  public async remove(
    capability: Pick<
      PrivateBlobReservation,
      'blobId' | 'origin' | 'uploadToken'
    >,
  ): Promise<void> {
    const foreign = this.foreignOrigin(capability.origin);
    const client = foreign ? this.origins.client(foreign) : this.http;

    await this.unavailableWhenNotFound(
      client.request<void>(
        `${reservationPath}/${encodeURIComponent(capability.blobId)}`,
        {
          headers: { Authorization: `Bearer ${capability.uploadToken}` },
          method: 'DELETE',
        },
      ),
    );
  }

  /**
   * Reads the part from its origin. An origin that fails the canonical rule is
   * ignored and the session node is used instead, so it is never fetched.
   * No Range header is sent, so the node answers only with 200.
   * The read, body included, aborts after privateBlobDownloadTimeoutMs.
   */
  public async download(
    reference: Pick<
      PrivateBlobReference,
      'blobId' | 'downloadToken' | 'origin' | 'size'
    >,
  ): Promise<ArrayBuffer> {
    const origin = MailboxHomeBase.parse(reference.origin);
    const source = origin ? this.origins.client(origin) : this.http;
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      privateBlobDownloadTimeoutMs,
    );

    try {
      const blob = await this.unavailableWhenNotFound(
        source.requestBlob(
          `${reservationPath}/${encodeURIComponent(reference.blobId)}`,
          {
            headers: { Authorization: `Bearer ${reference.downloadToken}` },
            redirect: 'error',
            signal: controller.signal,
          },
        ),
      );

      if (blob.size !== reference.size) {
        throw new PrivateBlobUnavailableError();
      }

      return await blob.arrayBuffer();
    } finally {
      clearTimeout(timeout);
    }
  }
}
