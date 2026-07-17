import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import { ConversationLatestMessageAt } from '../value-objects/ConversationLatestMessageAt';
import { ConversationPreview } from '../value-objects/ConversationPreview';
import { ConversationUnreadCount } from '../value-objects/ConversationUnreadCount';

export class ConversationActivity {
  public static empty(): ConversationActivity {
    return new ConversationActivity(
      ConversationLatestMessageAt.empty(),
      ConversationPreview.fromOptional(),
      ConversationUnreadCount.fromNumber(0),
    );
  }

  public static fromPrimitives(
    primitives: PrimitiveOf<ConversationActivity>,
  ): ConversationActivity {
    return new ConversationActivity(
      ConversationLatestMessageAt.fromOptional(primitives.latestMessageAt),
      ConversationPreview.fromOptional(primitives.latestMessagePreview),
      ConversationUnreadCount.fromNumber(primitives.unreadCount),
    );
  }

  private constructor(
    private readonly latestMessageAt: ConversationLatestMessageAt,
    private latestMessagePreview: ConversationPreview,
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

  public record(occurredAt: Timestamp, preview?: ConversationPreview): boolean {
    if (!this.latestMessageAt.record(occurredAt)) return false;

    if (preview) this.latestMessagePreview = preview;

    return true;
  }

  public toPrimitives() {
    return {
      latestMessageAt: this.latestMessageAt.toPrimitives(),
      latestMessagePreview: this.latestMessagePreview.isPresent()
        ? this.latestMessagePreview.toString()
        : undefined,
      unreadCount: this.unreadCount.valueOf(),
    };
  }
}
