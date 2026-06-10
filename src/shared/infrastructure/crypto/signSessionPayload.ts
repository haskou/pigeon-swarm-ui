import type { Signature } from '@haskou/value-objects';

import type { Session } from '../../domain/pigeonResources.types';

export async function signSessionPayload(
  session: Session,
  payload: string,
): Promise<Signature> {
  if (session.keyPair) return session.keyPair.sign(payload);

  return await session.encryptedKeyPair.sign(payload, session.password);
}
