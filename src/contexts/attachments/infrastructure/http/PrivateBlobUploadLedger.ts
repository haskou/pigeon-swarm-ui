import { EncryptedPayload } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../identities/infrastructure/session/Session';

export type PrivateBlobUploadTicket = {
  blobId: string;
  origin?: string;
  uploadToken: string;
};

export type PrivateBlobUploadRef = Pick<
  PrivateBlobUploadTicket,
  'blobId' | 'origin'
>;

/**
 * Upload tokens of replicas this client stored and has not settled yet, sealed
 * in local storage so an abandoned send can still delete its replicas.
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
        session.masterKey.decrypt(new EncryptedPayload(raw)).toString(),
      );

      return Array.isArray(parsed) ? (parsed as PrivateBlobUploadTicket[]) : [];
    } catch {
      return [];
    }
  }

  private write(session: Session, tickets: PrivateBlobUploadTicket[]): void {
    this.storage.setItem(
      this.storageKey(session),
      session.masterKey.encrypt(JSON.stringify(tickets)).toString(),
    );
  }
}
