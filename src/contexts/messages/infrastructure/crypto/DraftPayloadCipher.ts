import { EncryptedPayload } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../identities/infrastructure/session/Session';
import type { DraftPlainPayload } from './DraftPlainPayload';

import { sessionRootKey } from '../../../identities/infrastructure/session/sessionRootKey';

/**
 * Drafts sync through the node, so they seal under the device-sealed root
 * every current device of the identity holds.
 */
export class DraftPayloadCipher {
  /** Returns null for a draft that does not open under the current root. */
  public decrypt(session: Session, encryptedPayload: string): string | null {
    const root = sessionRootKey(session);

    try {
      const parsed = JSON.parse(
        root.decrypt(new EncryptedPayload(encryptedPayload)).toString(),
      ) as Partial<DraftPlainPayload>;

      return typeof parsed.content === 'string' ? parsed.content : null;
    } catch {
      return null;
    }
  }

  public encrypt(session: Session, content: string): string {
    return sessionRootKey(session)
      .encrypt(JSON.stringify({ content }))
      .toString();
  }
}
