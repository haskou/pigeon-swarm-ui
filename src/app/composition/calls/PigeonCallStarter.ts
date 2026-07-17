import type { CallResource } from '../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { Session } from '../../../shared/domain/pigeonResources.types';

import { CommunityChannelCallStarter } from '../../../contexts/calls/application/start-community-channel-call/CommunityChannelCallStarter';
import { StartCommunityChannelCallMessage } from '../../../contexts/calls/application/start-community-channel-call/messages/StartCommunityChannelCallMessage';
import { ConversationCallStarter } from '../../../contexts/calls/application/start-conversation-call/ConversationCallStarter';
import { StartConversationCallMessage } from '../../../contexts/calls/application/start-conversation-call/messages/StartConversationCallMessage';
import { CallMapper } from '../../../contexts/calls/infrastructure/http/CallMapper';
import { CallSessionRegistrar } from './CallSessionRegistrar';

export class PigeonCallStarter {
  public constructor(
    private readonly sessions: CallSessionRegistrar,
    private readonly mapper: CallMapper,
    private readonly conversation: ConversationCallStarter,
    private readonly communityChannel: CommunityChannelCallStarter,
  ) {}

  public async startCommunityChannel(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<CallResource> {
    const call = await this.communityChannel.start(
      new StartCommunityChannelCallMessage(
        communityId,
        channelId,
        this.sessions.register(session),
      ),
    );

    return this.mapper.toResource(call);
  }

  public async startConversation(
    session: Session,
    conversationId: string,
  ): Promise<CallResource> {
    const call = await this.conversation.start(
      new StartConversationCallMessage(
        conversationId,
        this.sessions.register(session),
      ),
    );

    return this.mapper.toResource(call);
  }
}
