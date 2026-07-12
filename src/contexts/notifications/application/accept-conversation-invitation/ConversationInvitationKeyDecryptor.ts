import type {
  ConversationKeyEntry,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface ConversationInvitationKeyDecryptor {
  decryptInvitationKey(
    session: Session,
    encryptedKey: string,
  ): Promise<ConversationKeyEntry>;
}
