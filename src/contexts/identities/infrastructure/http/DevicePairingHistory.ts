import type { Session } from '../session/Session';

/**
 * Pairing history transfer, keyed by the one-time secret the new device gets
 * in its completion. Neither call throws.
 */
export interface DevicePairingHistory {
  /** Publishes this identity's history; a failure leaves it partial or gone. */
  publish(session: Session, secret: Uint8Array): Promise<void>;
  /** Imports the history published under `secret` into a rooted session. */
  receive(session: Session, secret: Uint8Array): Promise<void>;
}
