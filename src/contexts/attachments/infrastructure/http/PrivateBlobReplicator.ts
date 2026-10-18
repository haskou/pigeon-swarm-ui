import type { Session } from '../../../identities/infrastructure/session/Session';
import type { PrivateBlobReservation } from '../../application/contracts/PrivateBlobReservation';
import type { PrivateBlobUploadTicket } from '../../domain/value-objects/PrivateBlobUploadTicket';
import type { PigeonPrivateBlobClient } from './PigeonPrivateBlobClient';
import type {
  PrivateBlobUploadLedger,
  PrivateBlobUploadRef,
} from './PrivateBlobUploadLedger';

import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';
import { PrivateBlobUploadIncompleteError } from '../../domain/errors/PrivateBlobUploadIncompleteError';
import { PrivateBlobReplicationDomainService } from '../../domain/services/PrivateBlobReplicationDomainService';

export type StoredPrivateBlobReplica = {
  blobId: string;
  downloadToken: string;
  expiresAt: number;
  origin?: string;
  uploadToken: string;
};

/**
 * A non-sensitive label for a failed attempt: the HTTP status or the error
 * class. Messages and bodies can carry identifiers or paths, so they stay out.
 */
function describeFailure(error: unknown): string {
  if (error instanceof HttpJsonError) return `HTTP ${error.status}`;

  return error instanceof Error ? error.name : 'NonError';
}

export class PrivateBlobReplicator {
  public constructor(
    private readonly privateBlobs: Pick<
      PigeonPrivateBlobClient,
      'remove' | 'reserve' | 'upload'
    >,
    private readonly ledger: PrivateBlobUploadLedger,
    private readonly options: {
      attempts: number;
      now: () => number;
      retryDelayMs: number;
      wait: (ms: number) => Promise<void>;
    },
  ) {}

  /**
   * Uploads every part to every origin (`undefined` is the session node) and
   * resolves with each part's replicas. PrivateBlobReplicationDomainService
   * abandons the stored replicas and rejects when any part ends with none; that
   * rejection carries the reasons of the failed attempts.
   */
  public async storeParts(
    session: Session,
    count: number,
    partAt: (index: number) => ArrayBuffer,
    origins: (string | undefined)[],
  ): Promise<StoredPrivateBlobReplica[][]> {
    const parts = Array.from({ length: count }, (_, index) => partAt(index));
    const failures: string[] = [];

    try {
      return await PrivateBlobReplicationDomainService.storeParts(
        {
          abandon: (replicas) => this.abandon(session, replicas),
          storePart: async (index) => {
            const replicas = await Promise.all(
              origins.map((origin) =>
                this.storeReplica(session, parts[index], origin, failures),
              ),
            );

            return replicas.filter(
              (replica): replica is StoredPrivateBlobReplica =>
                replica !== undefined,
            );
          },
        },
        count,
      );
    } catch (error) {
      if (error instanceof PrivateBlobUploadIncompleteError) {
        throw new PrivateBlobUploadIncompleteError([...new Set(failures)]);
      }

      throw error;
    }
  }

  /**
   * Removes the remote replicas that this client still holds tickets for.
   * Never rejects: a failed removal is not retried.
   */
  public async abandon(
    session: Session,
    refs: PrivateBlobUploadRef[],
  ): Promise<void> {
    await Promise.all(
      this.ledger
        .take(session, refs)
        .map((ticket) => this.removeQuietly(ticket)),
    );
  }

  public settle(session: Session, refs: PrivateBlobUploadRef[]): void {
    this.ledger.forget(session, refs);
  }

  private async storeReplica(
    session: Session,
    bytes: ArrayBuffer,
    target: string | undefined,
    failures: string[],
  ): Promise<StoredPrivateBlobReplica | undefined> {
    const reservation = await this.uploadWithRetries(
      session,
      bytes,
      target,
      failures,
    );

    if (reservation === undefined) return undefined;

    const origin = target ?? reservation.origin;
    const ticket = {
      blobId: reservation.blobId,
      origin,
      uploadToken: reservation.uploadToken,
    };

    try {
      this.ledger.remember(session, [ticket]);
    } catch (error) {
      failures.push(describeFailure(error));
      // Never recorded, so no abandon can reach it: remove it now.
      await this.removeQuietly(ticket);

      return undefined;
    }

    return {
      ...ticket,
      downloadToken: reservation.downloadToken,
      expiresAt: reservation.expiresAt,
    };
  }

  private async removeQuietly(ticket: PrivateBlobUploadTicket): Promise<void> {
    try {
      await this.privateBlobs.remove(ticket);
    } catch {
      // Best effort: a failed removal is not retried.
    }
  }

  private async uploadWithRetries(
    session: Session,
    bytes: ArrayBuffer,
    target: string | undefined,
    failures: string[],
  ): Promise<PrivateBlobReservation | undefined> {
    const { attempts, now, retryDelayMs, wait } = this.options;
    let reservation: PrivateBlobReservation | undefined;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        if (reservation === undefined || now() >= reservation.expiresAt) {
          reservation = await this.privateBlobs.reserve(
            session,
            bytes.byteLength,
            target,
          );
        }

        const origin = target ?? reservation.origin;

        await this.privateBlobs.upload(
          reservation.origin === origin
            ? reservation
            : { ...reservation, origin },
          bytes,
        );

        return reservation;
      } catch (error) {
        failures.push(describeFailure(error));

        if (attempt < attempts) await wait(retryDelayMs * attempt);
      }
    }

    return undefined;
  }
}
