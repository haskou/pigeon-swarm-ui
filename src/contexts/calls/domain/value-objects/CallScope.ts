import type { PrimitiveOf } from '@haskou/value-objects';

import { CallScopeIdentifier } from './CallScopeIdentifier';
import { CallScopeType } from './CallScopeType';

export class CallScope {
  public static fromPrimitives(primitives: PrimitiveOf<CallScope>): CallScope {
    if (primitives.type === 'community_channel') {
      return CallScope.communityChannel(
        CallScopeIdentifier.fromString(primitives.communityId),
        CallScopeIdentifier.fromString(primitives.channelId),
      );
    }

    if (primitives.type === 'group_capability') {
      return CallScope.groupCapability(
        CallScopeIdentifier.fromString(primitives.capabilityHash),
      );
    }

    return CallScope.conversation(
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

  /**
   * A group call names neither its group nor its members: only the SHA-256
   * of the capability its members derive from the group's MLS epoch.
   */
  public static groupCapability(
    capabilityHash: CallScopeIdentifier,
  ): CallScope {
    return new CallScope(CallScopeType.GROUP_CAPABILITY, capabilityHash);
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

    if (this.type.isGroupCapability()) {
      const primitives: { capabilityHash: string; type: 'group_capability' } = {
        capabilityHash: this.firstIdentifier.toString(),
        type: 'group_capability',
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
