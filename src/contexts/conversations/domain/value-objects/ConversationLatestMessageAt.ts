import { Timestamp } from '@haskou/value-objects';

export class ConversationLatestMessageAt {
  public static empty(): ConversationLatestMessageAt {
    return new ConversationLatestMessageAt();
  }

  public static fromOptional(value?: number): ConversationLatestMessageAt {
    return new ConversationLatestMessageAt(
      value === undefined ? undefined : new Timestamp(value),
    );
  }

  private constructor(private value?: Timestamp) {}

  public isAfter(other: ConversationLatestMessageAt): boolean {
    if (!this.value) return false;

    if (!other.value) return true;

    return this.value.isAfter(other.value);
  }

  public record(occurredAt: Timestamp): boolean {
    if (this.value && !occurredAt.isAfter(this.value)) return false;

    this.value = occurredAt;

    return true;
  }

  public toPrimitives() {
    return this.value?.valueOf();
  }
}
