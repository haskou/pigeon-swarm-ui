import { EncryptedPayload } from '@haskou/value-objects';

import type {
  ConversationKeyEntry,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { ConversationInvitationKeyDecryptor } from '../../application/accept-conversation-invitation/ConversationInvitationKeyDecryptor';

// eslint-disable-next-line max-len
export class PigeonConversationInvitationKeyDecryptor implements ConversationInvitationKeyDecryptor {
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
