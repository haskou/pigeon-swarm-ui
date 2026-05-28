import type {
  ConversationResource,
  LoginResult,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { LoginIdentityPort } from '../ports/LoginIdentityPort';

import { ConversationTimeline } from '../../../conversations/domain/ConversationTimeline';
import { MessageCollection } from '../../../messages/domain/MessageCollection';
import { LoginIdentityMessage } from './messages/LoginIdentityMessage';

export class LoginIdentity {
  public constructor(private readonly identities: LoginIdentityPort) {}

  public async login(message: LoginIdentityMessage): Promise<LoginResult> {
    const result = await this.identities.login(
      message.getIdentityId(),
      message.getPassword(),
    );

    return {
      ...result,
      conversations: ConversationTimeline.sortByLatestMessage(
        await this.withLatestMessageActivity(
          result.session,
          result.conversations,
        ),
      ),
    };
  }

  private async withLatestMessageActivity(
    session: Session,
    conversations: ConversationResource[],
  ): Promise<ConversationResource[]> {
    return await Promise.all(
      conversations.map(async (conversation) => {
        if (conversation.latestMessageAt) return conversation;

        try {
          const { messages } = await this.identities.loadMessages(
            session,
            conversation.id,
            null,
            1,
          );
          const latestMessageAt =
            MessageCollection.latestDeliveredTimestamp(messages);

          return latestMessageAt !== undefined
            ? { ...conversation, latestMessageAt }
            : conversation;
        } catch {
          return conversation;
        }
      }),
    );
  }
}
