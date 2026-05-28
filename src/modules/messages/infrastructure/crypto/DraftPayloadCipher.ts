import { EncryptedPayload, PublicKey } from '@haskou/value-objects';

import type { Session } from '../../../../shared/domain/pigeonResources.types';

type DraftPlainPayload = {
  content: string;
};

export class DraftPayloadCipher {
  public async decrypt(
    session: Session,
    encryptedPayload: string,
  ): Promise<string> {
    const decrypted = await session.encryptedKeyPair.decrypt(
      new EncryptedPayload(encryptedPayload),
      session.password,
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
    return PublicKey.fromPEM(session.identity.encryptedKeyPair.publicKey)
      .encrypt(JSON.stringify({ content }))
      .toString();
  }
}
