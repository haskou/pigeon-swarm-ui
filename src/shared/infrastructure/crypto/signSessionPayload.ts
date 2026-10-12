import type { Signature } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../contexts/identities/infrastructure/session/Session';

export function signSessionPayload(
  session: Session,
  payload: string,
): Promise<Signature> {
  return Promise.resolve(session.keyPair.sign(payload));
}
