import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import { ConversationLatestMessageAt } from '../value-objects/ConversationLatestMessageAt';
import { ConversationUnreadCount } from '../value-objects/ConversationUnreadCount';

export class ConversationActivity {
  public static empty(): ConversationActivity {
    return new ConversationActivity(
      ConversationLatestMessageAt.empty(),
      ConversationUnreadCount.fromNumber(0),
    );
  }

  public static fromPrimitives(
    primitives: PrimitiveOf<ConversationActivity>,
  ): ConversationActivity {
    return new ConversationActivity(
      ConversationLatestMessageAt.fromOptional(primitives.latestMessageAt),
      ConversationUnreadCount.fromNumber(primitives.unreadCount),
    );
  }

  private constructor(
    private readonly latestMessageAt: ConversationLatestMessageAt,
    private unreadCount: ConversationUnreadCount,
  ) {}

  public isMoreRecentThan(activity: ConversationActivity): boolean {
    return this.latestMessageAt.isAfter(activity.latestMessageAt);
  }

  public markRead(): boolean {
    if (this.unreadCount.isZero()) return false;

    this.unreadCount = this.unreadCount.clear();

    return true;
  }

  public record(occurredAt: Timestamp): boolean {
    return this.latestMessageAt.record(occurredAt);
  }

  public toPrimitives() {
    return {
      latestMessageAt: this.latestMessageAt.toPrimitives(),
      unreadCount: this.unreadCount.valueOf(),
    };
  }
}
