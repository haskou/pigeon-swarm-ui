import { Timestamp, UUID } from '@haskou/value-objects';

import type { DirectDeletedRecord } from './DirectDeletedRecord';
import type { DirectEditedRecord } from './DirectEditedRecord';
import type { DirectIdentityUpdatedRecord } from './DirectIdentityUpdatedRecord';
import type { DirectMessageRecord } from './DirectMessageRecord';
import type { DirectPinRecord } from './DirectPinRecord';
import type { DirectPollCloseRecord } from './DirectPollCloseRecord';
import type { DirectPollRecord } from './DirectPollRecord';
import type { DirectPollVoteRecord } from './DirectPollVoteRecord';
import type { DirectReactionRecord } from './DirectReactionRecord';
import type { DirectReadRecord } from './DirectReadRecord';
import type { DirectSentRecord } from './DirectSentRecord';
import type { DirectTypingRecord } from './DirectTypingRecord';

/**
 * Shape rules for direct mailbox records. Sent and edited records take their
 * ids from the message, a poll from the poll and a typing notice or an
 * identity update from its caller; every other record gets a fresh UUID
 * here. Deleted and read records are stamped with the current clock;
 * reaction, pin, poll, typing and identity update records keep the caller's
 * clock reading, which also orders them.
 * Keys are listed alphabetically: their order is part of the encoded bytes.
 */
export class DirectMailboxRecords {
  private static readonly RECEIPT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
  private static readonly RECEIPT_MAX_FUTURE_SKEW_MS = 30_000;

  /** The `type` discriminant that each direct mailbox record carries. */
  public static readonly TYPE = {
    deleted: 'deleted',
    edited: 'edited',
    identityUpdated: 'identity_updated',
    pin: 'pin',
    poll: 'poll',
    pollClose: 'poll_close',
    pollVote: 'poll_vote',
    reaction: 'reaction',
    read: 'read',
    sent: 'sent',
    typing: 'typing',
  } as const;

  public static sent(fields: Omit<DirectSentRecord, 'type'>): DirectSentRecord {
    return {
      authorId: fields.authorId,
      conversationId: fields.conversationId,
      createdAt: fields.createdAt,
      encryptedPayload: fields.encryptedPayload,
      id: fields.id,
      previousMessageIds: fields.previousMessageIds,
      replyToMessageId: fields.replyToMessageId,
      type: 'sent',
    };
  }

  /** An edit links to the message it replaces, so the link is derived here. */
  public static edited(
    fields: Omit<DirectEditedRecord, 'previousMessageIds' | 'type'>,
  ): DirectEditedRecord {
    return {
      authorId: fields.authorId,
      conversationId: fields.conversationId,
      createdAt: fields.createdAt,
      encryptedPayload: fields.encryptedPayload,
      id: fields.id,
      previousMessageIds: [fields.targetMessageId],
      targetMessageId: fields.targetMessageId,
      type: 'edited',
    };
  }

  public static deleted(
    fields: Omit<DirectDeletedRecord, 'createdAt' | 'id' | 'type'>,
  ): DirectDeletedRecord {
    return {
      authorId: fields.authorId,
      conversationId: fields.conversationId,
      createdAt: Timestamp.now().valueOf(),
      id: UUID.generate().toString(),
      targetMessageId: fields.targetMessageId,
      type: 'deleted',
    };
  }

  public static reaction(
    fields: Omit<DirectReactionRecord, 'id' | 'type'>,
  ): DirectReactionRecord {
    return {
      action: fields.action,
      authorId: fields.authorId,
      conversationId: fields.conversationId,
      createdAt: fields.createdAt,
      emoji: fields.emoji,
      id: UUID.generate().toString(),
      targetMessageId: fields.targetMessageId,
      type: 'reaction',
    };
  }

  public static pin(
    fields: Omit<DirectPinRecord, 'id' | 'type'>,
  ): DirectPinRecord {
    return {
      action: fields.action,
      authorId: fields.authorId,
      conversationId: fields.conversationId,
      createdAt: fields.createdAt,
      id: UUID.generate().toString(),
      targetMessageId: fields.targetMessageId,
      type: 'pin',
    };
  }

  public static poll(fields: Omit<DirectPollRecord, 'type'>): DirectPollRecord {
    return {
      allowsMultipleVotes: fields.allowsMultipleVotes,
      authorId: fields.authorId,
      conversationId: fields.conversationId,
      createdAt: fields.createdAt,
      id: fields.id,
      options: fields.options.map((option) => ({
        id: option.id,
        text: option.text,
      })),
      question: fields.question,
      type: 'poll',
    };
  }

  public static pollVote(
    fields: Omit<DirectPollVoteRecord, 'id' | 'type'>,
  ): DirectPollVoteRecord {
    return {
      authorId: fields.authorId,
      conversationId: fields.conversationId,
      createdAt: fields.createdAt,
      id: UUID.generate().toString(),
      optionIds: [...fields.optionIds],
      targetPollId: fields.targetPollId,
      type: 'poll_vote',
    };
  }

  public static pollClose(
    fields: Omit<DirectPollCloseRecord, 'id' | 'type'>,
  ): DirectPollCloseRecord {
    return {
      authorId: fields.authorId,
      conversationId: fields.conversationId,
      createdAt: fields.createdAt,
      id: UUID.generate().toString(),
      targetPollId: fields.targetPollId,
      type: 'poll_close',
    };
  }

  public static read(
    fields: Omit<DirectReadRecord, 'createdAt' | 'id' | 'type'>,
  ): DirectReadRecord {
    return {
      authorId: fields.authorId,
      conversationId: fields.conversationId,
      createdAt: Timestamp.now().valueOf(),
      id: UUID.generate().toString(),
      targetMessageId: fields.targetMessageId,
      type: 'read',
    };
  }

  /** An ephemeral notice that its author is typing; never stored. */
  public static typing(
    fields: Omit<DirectTypingRecord, 'type'>,
  ): DirectTypingRecord {
    return {
      authorId: fields.authorId,
      conversationId: fields.conversationId,
      createdAt: fields.createdAt,
      id: fields.id,
      type: 'typing',
    };
  }

  /** An ephemeral notice that its author updated its identity; never stored. */
  public static identityUpdated(
    fields: Omit<DirectIdentityUpdatedRecord, 'type'>,
  ): DirectIdentityUpdatedRecord {
    return {
      authorId: fields.authorId,
      conversationId: fields.conversationId,
      createdAt: fields.createdAt,
      id: fields.id,
      type: 'identity_updated',
    };
  }

  /**
   * A read receipt is fresh when it is at most 14 days old and at most 30
   * seconds ahead of this device's clock. Stale or future-dated receipts are
   * ignored, matching the node's read-proof window.
   */
  public static isFreshReceipt(record: DirectReadRecord, now: number): boolean {
    return (
      now - record.createdAt <= DirectMailboxRecords.RECEIPT_MAX_AGE_MS &&
      record.createdAt - now <= DirectMailboxRecords.RECEIPT_MAX_FUTURE_SKEW_MS
    );
  }

  /** Sent and edited records carry message content that must be decrypted. */
  public static carriesMessage(
    record: DirectMessageRecord,
  ): record is DirectEditedRecord | DirectSentRecord {
    return (
      record.type === DirectMailboxRecords.TYPE.sent ||
      record.type === DirectMailboxRecords.TYPE.edited
    );
  }
}
