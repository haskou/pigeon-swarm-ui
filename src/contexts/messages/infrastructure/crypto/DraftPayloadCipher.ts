import { EncryptedPayload } from '@haskou/value-objects';

import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { DraftPlainPayload } from './DraftPlainPayload';

export class DraftPayloadCipher {
  public decrypt(session: Session, encryptedPayload: string): string {
    const decrypted = session.masterKey.decrypt(
      new EncryptedPayload(encryptedPayload),
    );
    const plaintext = decrypted.toString();

    try {
      const parsed = JSON.parse(plaintext) as Partial<DraftPlainPayload>;

      return typeof parsed.content === 'string' ? parsed.content : plaintext;
    } catch {
      return plaintext;
    }
  }

  public encrypt(session: Session, content: string): string {
    return session.masterKey.encrypt(JSON.stringify({ content })).toString();
  }
}
