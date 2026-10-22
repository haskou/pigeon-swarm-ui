import type { Session } from '../../../contexts/identities/infrastructure/session/Session';

/**
 * Supplies the device authorization revision a device observes immediately
 * before it signs a public mutation. The revision is part of the signed body,
 * so nodes can evaluate the device at that point of its authorization chain.
 */
export interface AuthorizationRevisionSource {
  current(session: Session): Promise<number>;
  /**
   * The revision this device last observed, answered without any request:
   * for a page being torn down, which cancels every request it starts. The
   * claim grants nothing new: a node accepts a signature at any revision of
   * the retained chain at which the device was authorized, and the signer
   * chooses that revision either way.
   */
  observed(session: Session): number;
}
