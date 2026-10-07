import type { Session } from '../../domain/pigeonResources.types';

/**
 * Supplies the device authorization revision a device observes immediately
 * before it signs a public mutation. The revision is part of the signed body,
 * so nodes can evaluate the device at that point of its authorization chain.
 */
export interface AuthorizationRevisionSource {
  current(session: Session): Promise<number>;
}
