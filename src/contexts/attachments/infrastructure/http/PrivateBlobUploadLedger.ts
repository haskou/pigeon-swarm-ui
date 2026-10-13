import { EncryptedPayload } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../identities/infrastructure/session/Session';

import {
  isPrivateBlobUploadTicket,
  type PrivateBlobUploadTicket,
} from '../../domain/value-objects/PrivateBlobUploadTicket';

export type PrivateBlobUploadRef = Pick<
  PrivateBlobUploadTicket,
  'blobId' | 'origin'
>;

/**
 * Upload tokens of replicas this client stored and has not settled yet, sealed
 * in local storage under this device's credential key so an abandoned send can
 * still delete its replicas. Stored entries that do not open or fail the ticket
 * shape check are ignored and dropped on the next write.
 */
export class PrivateBlobUploadLedger {
  private static readonly capacity = 200;

  public constructor(
    private readonly storage: Pick<
      Storage,
      'getItem' | 'removeItem' | 'setItem'
    >,
    private readonly storageKey: (session: Session) => string,
  ) {}

  public forget(session: Session, refs: PrivateBlobUploadRef[]): void {
    this.pull(session, refs);
  }

  public remember(session: Session, tickets: PrivateBlobUploadTicket[]): void {
    const kept = [...this.read(session), ...tickets];

    this.write(session, kept.slice(-PrivateBlobUploadLedger.capacity));
  }

  public take(
    session: Session,
    refs: PrivateBlobUploadRef[],
  ): PrivateBlobUploadTicket[] {
    return this.pull(session, refs);
  }

  private pull(
    session: Session,
    refs: PrivateBlobUploadRef[],
  ): PrivateBlobUploadTicket[] {
    const tickets = this.read(session);
    const pulled = tickets.filter((ticket) =>
      refs.some(
        (ref) => ref.blobId === ticket.blobId && ref.origin === ticket.origin,
      ),
    );

    if (pulled.length > 0) {
      this.write(
        session,
        tickets.filter((ticket) => !pulled.includes(ticket)),
      );
    }

    return pulled;
  }

  private read(session: Session): PrivateBlobUploadTicket[] {
    const raw = this.storage.getItem(this.storageKey(session));

    if (raw === null) return [];

    try {
      const parsed: unknown = JSON.parse(
        session.deviceCredentialKeyPair
          .decrypt(new EncryptedPayload(raw))
          .toString(),
      );

      return Array.isArray(parsed)
        ? parsed.filter(isPrivateBlobUploadTicket)
        : [];
    } catch {
      return [];
    }
  }

  private write(session: Session, tickets: PrivateBlobUploadTicket[]): void {
    this.storage.setItem(
      this.storageKey(session),
      session.deviceCredentialKeyPair
        .encrypt(JSON.stringify(tickets))
        .toString(),
    );
  }
}
