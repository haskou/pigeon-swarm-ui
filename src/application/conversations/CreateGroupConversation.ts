import type {
  ConversationResource,
  LocalKeychain,
  Session,
} from '../../domain/types';

import { PigeonApiGateway } from '../../infrastructure/pigeon-api/PigeonApiGateway';

export type CreateGroupConversationInput = {
  name: string;
  networkId: string;
  participantIds: string[];
};

export class CreateGroupConversation {
  public constructor(private readonly gateway: PigeonApiGateway) {}

  public async execute(
    session: Session,
    input: CreateGroupConversationInput,
  ): Promise<{
    conversation: ConversationResource;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    return await this.gateway.createGroupConversation(session, input);
  }
}
