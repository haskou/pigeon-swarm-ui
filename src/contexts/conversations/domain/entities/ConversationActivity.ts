import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import { ConversationLatestMessageAt } from '../value-objects/ConversationLatestMessageAt';

/**
 * The latest activity of a conversation. Unread state is not part of it: the
 * node cannot know the read state of sealed content, so each device keeps its
 * own unread counts.
 */
export class ConversationActivity {
  public static empty(): ConversationActivity {
    return new ConversationActivity(ConversationLatestMessageAt.empty());
  }

  public static fromPrimitives(
    primitives: PrimitiveOf<ConversationActivity>,
  ): ConversationActivity {
    return new ConversationActivity(
      ConversationLatestMessageAt.fromOptional(primitives.latestMessageAt),
    );
  }

  private constructor(
    private readonly latestMessageAt: ConversationLatestMessageAt,
  ) {}

  public isMoreRecentThan(activity: ConversationActivity): boolean {
    return this.latestMessageAt.isAfter(activity.latestMessageAt);
  }

  public record(occurredAt: Timestamp): boolean {
    return this.latestMessageAt.record(occurredAt);
  }

  public toPrimitives() {
    return {
      latestMessageAt: this.latestMessageAt.toPrimitives(),
    };
  }
}
