import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import { CommunityThreadMessageId } from '../value-objects/CommunityThreadMessageId';
import { CommunityThreadReplyCount } from '../value-objects/CommunityThreadReplyCount';

export class CommunityChannelThreadSummary {
  public static fromPrimitives(
    primitives: PrimitiveOf<CommunityChannelThreadSummary>,
  ): CommunityChannelThreadSummary {
    return new CommunityChannelThreadSummary(
      CommunityThreadMessageId.fromString(primitives.rootMessageId),
      CommunityThreadReplyCount.fromNumber(primitives.replyCount),
      new Timestamp(primitives.lastReplyAt),
      CommunityThreadMessageId.fromString(primitives.lastReplyMessageId),
    );
  }

  private constructor(
    private readonly rootMessageId: CommunityThreadMessageId,
    private readonly replyCount: CommunityThreadReplyCount,
    private readonly lastReplyAt: Timestamp,
    private readonly lastReplyMessageId: CommunityThreadMessageId,
  ) {}

  public toPrimitives() {
    return {
      lastReplyAt: this.lastReplyAt.valueOf(),
      lastReplyMessageId: this.lastReplyMessageId.toString(),
      replyCount: this.replyCount.valueOf(),
      rootMessageId: this.rootMessageId.toString(),
    };
  }
}
