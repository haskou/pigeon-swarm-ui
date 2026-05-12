import type { LoginResult } from '../../domain/types';

import { sortConversationsByLatestMessage } from '../../domain/conversations/conversationOrdering';
import { PigeonApiGateway } from '../../infrastructure/pigeon-api/PigeonApiGateway';

export class LoginIdentity {
  public constructor(private readonly gateway: PigeonApiGateway) {}

  public async execute(
    identityId: string,
    password: string,
  ): Promise<LoginResult> {
    const result = await this.gateway.login(identityId, password);

    return {
      ...result,
      conversations: sortConversationsByLatestMessage(result.conversations),
    };
  }
}
