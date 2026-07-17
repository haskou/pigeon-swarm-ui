import type { PrimitiveOf } from '@haskou/value-objects';

import { CallScopeIdentifier } from './CallScopeIdentifier';
import { CallScopeType } from './CallScopeType';

export class CallScope {
  public static fromPrimitives(primitives: PrimitiveOf<CallScope>): CallScope {
    return primitives.type === 'community_channel'
      ? CallScope.communityChannel(
          CallScopeIdentifier.fromString(primitives.communityId),
          CallScopeIdentifier.fromString(primitives.channelId),
        )
      : CallScope.conversation(
          CallScopeIdentifier.fromString(primitives.conversationId),
        );
  }

  public static communityChannel(
    communityId: CallScopeIdentifier,
    channelId: CallScopeIdentifier,
  ): CallScope {
    return new CallScope(
      CallScopeType.COMMUNITY_CHANNEL,
      communityId,
      channelId,
    );
  }

  public static conversation(conversationId: CallScopeIdentifier): CallScope {
    return new CallScope(CallScopeType.CONVERSATION, conversationId);
  }

  private constructor(
    private readonly type: CallScopeType,
    private readonly firstIdentifier: CallScopeIdentifier,
    private readonly secondIdentifier?: CallScopeIdentifier,
  ) {}

  public isCommunityChannel(): boolean {
    return this.type.isCommunityChannel();
  }

  public toPrimitives() {
    if (this.type.isCommunityChannel() && this.secondIdentifier) {
      const primitives: {
        channelId: string;
        communityId: string;
        type: 'community_channel';
      } = {
        channelId: this.secondIdentifier.toString(),
        communityId: this.firstIdentifier.toString(),
        type: 'community_channel',
      };

      return primitives;
    }

    const primitives: { conversationId: string; type: 'conversation' } = {
      conversationId: this.firstIdentifier.toString(),
      type: 'conversation',
    };

    return primitives;
  }
}
