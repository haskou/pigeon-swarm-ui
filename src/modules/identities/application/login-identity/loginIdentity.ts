import type { LoginResult } from '../../../../shared/domain/pigeonResources.types';

import { sortConversationsByLatestMessage } from '../../../conversations/domain/conversationOrdering';
import { PigeonApiGateway } from '../../../../app/composition/pigeonApiGateway';

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
