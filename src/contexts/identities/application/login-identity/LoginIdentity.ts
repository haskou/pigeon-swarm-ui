import type {
  ConversationResource,
  LoginResult,
} from '../../../../shared/domain/pigeonResources.types';
import type { LoginIdentityPort } from '../ports/LoginIdentityPort';

import { ConversationTimeline } from '../../../conversations/domain/ConversationTimeline';
import { LoginIdentityMessage } from './messages/LoginIdentityMessage';

export class LoginIdentity {
  public constructor(private readonly identities: LoginIdentityPort) {}

  private sortConversations(
    conversations: ConversationResource[],
  ): ConversationResource[] {
    return ConversationTimeline.sortByLatestMessage(conversations);
  }

  public async login(message: LoginIdentityMessage): Promise<LoginResult> {
    const result = await this.identities.login(
      message.getIdentityId(),
      message.getPassword(),
      message.getProgressReporter(),
    );

    return {
      ...result,
      conversations: this.sortConversations(result.conversations),
    };
  }
}
