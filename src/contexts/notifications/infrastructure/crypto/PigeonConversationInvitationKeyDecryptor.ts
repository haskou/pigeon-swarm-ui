import { EncryptedPayload } from '@haskou/pigeon-swarm-crypto';

import type { ConversationKeyEntry } from '../../../identities/infrastructure/keychain/ConversationKeyEntry';
import type { Session } from '../../../identities/infrastructure/session/Session';

export class PigeonConversationInvitationKeyDecryptor {
  public async decryptInvitationKey(
    session: Session,
    encryptedKey: string,
  ): Promise<ConversationKeyEntry> {
    const decrypted = await session.keyPair.decrypt(
      new EncryptedPayload(encryptedKey),
    );

    return JSON.parse(decrypted.toString()) as ConversationKeyEntry;
  }
}
