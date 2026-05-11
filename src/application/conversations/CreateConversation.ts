import type {
  ConversationResource,
  LocalKeychain,
  Session,
} from '../../domain/types';

import { PigeonApiGateway } from '../../infrastructure/pigeon-api/PigeonApiGateway';

export class CreateConversation {
  public constructor(private readonly gateway: PigeonApiGateway) {}

  public async execute(
    session: Session,
    peerIdentityId: string,
  ): Promise<{
    conversation: ConversationResource;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    return await this.gateway.createConversation(session, peerIdentityId);
  }
}
