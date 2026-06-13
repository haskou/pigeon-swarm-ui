import type { Signature } from '@haskou/value-objects';

import type { Session } from '../../domain/pigeonResources.types';

export function signSessionPayload(
  session: Session,
  payload: string,
): Promise<Signature> {
  return Promise.resolve(session.keyPair.sign(payload));
}
