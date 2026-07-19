import { assert, type PrimitiveOf } from '@haskou/value-objects';

import { InvalidPollScopeError } from '../errors/InvalidPollScopeError';
import { PollScopeIdentifier } from './PollScopeIdentifier';
import { PollScopeType } from './PollScopeType';

export class PollScope {
  public static communityChannel(
    communityId: PollScopeIdentifier,
    channelId: PollScopeIdentifier,
  ): PollScope {
    return new PollScope(
      PollScopeType.COMMUNITY_CHANNEL,
      communityId,
      channelId,
    );
  }

  public static fromPrimitives(primitives: PrimitiveOf<PollScope>): PollScope {
    const type = PollScopeType.fromPrimitives(primitives.type);

    if (type.isCommunityChannel()) {
      assert(primitives.secondIdentifier, new InvalidPollScopeError());

      return PollScope.communityChannel(
        PollScopeIdentifier.fromString(primitives.firstIdentifier),
        PollScopeIdentifier.fromString(primitives.secondIdentifier),
      );
    }

    return PollScope.groupConversation(
      PollScopeIdentifier.fromString(primitives.firstIdentifier),
    );
  }

  public static groupConversation(
    conversationId: PollScopeIdentifier,
  ): PollScope {
    return new PollScope(PollScopeType.GROUP_CONVERSATION, conversationId);
  }

  private constructor(
    private readonly type: PollScopeType,
    private readonly firstIdentifier: PollScopeIdentifier,
    private readonly secondIdentifier?: PollScopeIdentifier,
  ) {}

  public isCommunityChannel(): boolean {
    return this.type.isCommunityChannel();
  }

  public toPrimitives() {
    return {
      firstIdentifier: this.firstIdentifier.toString(),
      secondIdentifier: this.secondIdentifier?.toString(),
      type: this.type.valueOf(),
    };
  }
}
