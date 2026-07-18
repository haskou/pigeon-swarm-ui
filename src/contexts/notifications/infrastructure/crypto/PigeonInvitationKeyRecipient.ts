import type { PigeonIdentitiesGateway } from '../../../identities/infrastructure/http/PigeonIdentitiesGateway';
import type { InvitationKeyRecipient } from '../../domain/services/InvitationKeyRecipient';
import type { EncryptedInvitationKey } from '../../domain/value-objects/EncryptedInvitationKey';
import type { NotificationRecipientId } from '../../domain/value-objects/NotificationRecipientId';

import { ConversationKeychain } from '../../../identities/infrastructure/keychain/ConversationKeychain';
import { NotificationAccessContexts } from '../http/NotificationAccessContexts';
import { PigeonConversationInvitationKeyDecryptor } from './PigeonConversationInvitationKeyDecryptor';

export class PigeonInvitationKeyRecipient implements InvitationKeyRecipient {
  public constructor(
    private readonly contexts: NotificationAccessContexts,
    private readonly keyDecryptor: PigeonConversationInvitationKeyDecryptor,
    private readonly identities: PigeonIdentitiesGateway,
  ) {}

  public async receive(
    recipientIdentityId: NotificationRecipientId,
    encryptedInvitationKey: EncryptedInvitationKey,
  ): Promise<void> {
    const session = this.contexts.find(recipientIdentityId);
    const keyEntry = await this.keyDecryptor.decryptInvitationKey(
      session,
      encryptedInvitationKey.toString(),
    );
    const published = await this.identities.publishKeychain(
      session,
      ConversationKeychain.withEntry(session.keychain, keyEntry),
    );

    this.contexts.replace(recipientIdentityId, {
      ...session,
      keychain: published.keychain,
      keychainExternalIdentifier: published.keychainExternalIdentifier,
    });
  }
}
