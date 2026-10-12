import type { MessageResource } from '../http/MessageResource';

type RecordBase = {
  authorId: string;
  conversationId: string;
  createdAt: number;
  id: string;
};

/** A message sent to the peer: text, a reply, attachments, or a sticker. */
export type DirectSentRecord = RecordBase & {
  encryptedPayload: string;
  previousMessageIds: string[];
  replyToMessageId?: string;
  type: 'sent';
};

/** Replaces the content of an earlier sent message. */
export type DirectEditedRecord = RecordBase & {
  encryptedPayload: string;
  previousMessageIds: string[];
  targetMessageId: string;
  type: 'edited';
};

export type DirectDeletedRecord = RecordBase & {
  targetMessageId: string;
  type: 'deleted';
};

export type DirectReactionRecord = RecordBase & {
  action: 'add' | 'remove';
  emoji: string;
  targetMessageId: string;
  type: 'reaction';
};

/** Pin or unpin of a message. Applied last-writer-wins by createdAt. */
export type DirectPinRecord = RecordBase & {
  action: 'pin' | 'unpin';
  targetMessageId: string;
  type: 'pin';
};

/** Read receipt for this identity. Sent only to its own inbox. */
export type DirectReadRecord = RecordBase & {
  targetMessageId: string;
  type: 'read';
};

export type DirectMessageRecord =
  | DirectDeletedRecord
  | DirectEditedRecord
  | DirectPinRecord
  | DirectReactionRecord
  | DirectReadRecord
  | DirectSentRecord;

const DIRECT_MESSAGE_KIND = 'direct-message';
const DIRECT_MESSAGE_VERSION = 2;

type DirectMessageEnvelope = {
  kind: typeof DIRECT_MESSAGE_KIND;
  record: DirectMessageRecord;
  version: typeof DIRECT_MESSAGE_VERSION;
};

/** Some MessageResource fields exist under two names; use whichever is set. */
function mailboxFields(message: MessageResource) {
  return {
    authorId: message.authorId ?? message.authorIdentityId,
    createdAt: message.createdAt ?? message.timestamp,
    encryptedPayload: message.encryptedPayload ?? message.payload,
  };
}

export class DirectMessageMailboxRecord {
  private static readonly RECEIPT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
  private static readonly RECEIPT_MAX_FUTURE_SKEW_MS = 30_000;

  /** Only one-to-one conversations travel through the mailbox. */
  public static isEligible(conversationType: 'group' | 'one-to-one'): boolean {
    return conversationType === 'one-to-one';
  }

  public static fromSent(
    conversationId: string,
    sent: MessageResource,
  ): DirectSentRecord {
    const { authorId, createdAt, encryptedPayload } = mailboxFields(sent);

    if (!sent.id || !authorId || !encryptedPayload || createdAt === undefined) {
      throw new Error('Sent message is missing mailbox fields.');
    }

    return {
      authorId,
      conversationId,
      createdAt,
      encryptedPayload,
      id: sent.id,
      previousMessageIds: sent.previousMessageIds ?? [],
      replyToMessageId: sent.replyToMessageId,
      type: 'sent',
    };
  }

  public static fromEdited(
    conversationId: string,
    edited: MessageResource,
  ): DirectEditedRecord {
    const { authorId, createdAt, encryptedPayload } = mailboxFields(edited);
    const targetMessageId = edited.targetMessageId;

    if (
      !edited.id ||
      !authorId ||
      !encryptedPayload ||
      createdAt === undefined ||
      !targetMessageId
    ) {
      throw new Error('Edited message is missing mailbox fields.');
    }

    return {
      authorId,
      conversationId,
      createdAt,
      encryptedPayload,
      id: edited.id,
      previousMessageIds: [targetMessageId],
      targetMessageId,
      type: 'edited',
    };
  }

  /**
   * A read receipt is fresh when it is at most 14 days old and at most 30
   * seconds ahead of this device's clock. Stale or future-dated receipts are
   * ignored, matching the node's read-proof window.
   */
  public static isFreshReceipt(record: DirectReadRecord, now: number): boolean {
    return (
      now - record.createdAt <= DirectMessageMailboxRecord.RECEIPT_MAX_AGE_MS &&
      record.createdAt - now <=
        DirectMessageMailboxRecord.RECEIPT_MAX_FUTURE_SKEW_MS
    );
  }

  public static encode(record: DirectMessageRecord): Uint8Array {
    const envelope: DirectMessageEnvelope = {
      kind: DIRECT_MESSAGE_KIND,
      record,
      version: DIRECT_MESSAGE_VERSION,
    };

    return new TextEncoder().encode(JSON.stringify(envelope));
  }

  /**
   * Returns the record for this conversation, or null for anything that is not
   * a valid version 2 direct-message record. Callers skip null and still
   * acknowledge, so a bad or superseded (version 1) envelope cannot stall the
   * inbox.
   */
  public static decode(
    plaintext: Uint8Array,
    conversationId: string,
  ): DirectMessageRecord | null {
    let parsed: unknown;

    try {
      parsed = JSON.parse(new TextDecoder().decode(plaintext));
    } catch {
      return null;
    }

    if (!isDirectMessageEnvelope(parsed)) return null;

    return parsed.record.conversationId === conversationId
      ? parsed.record
      : null;
  }

  /** The resource the projection decrypts and places in the timeline. */
  public static toResource(
    record: DirectEditedRecord | DirectSentRecord,
  ): MessageResource {
    if (record.type === 'edited') {
      return {
        authorId: record.authorId,
        conversationId: record.conversationId,
        createdAt: record.createdAt,
        encryptedPayload: record.encryptedPayload,
        id: record.id,
        previousMessageIds: record.previousMessageIds,
        targetMessageId: record.targetMessageId,
        type: 'edited',
      };
    }

    return {
      authorId: record.authorId,
      conversationId: record.conversationId,
      createdAt: record.createdAt,
      encryptedPayload: record.encryptedPayload,
      id: record.id,
      previousMessageIds: record.previousMessageIds,
      replyToMessageId: record.replyToMessageId,
      type: 'sent',
    };
  }
}

function isDirectMessageEnvelope(
  value: unknown,
): value is DirectMessageEnvelope {
  if (!isObject(value)) return false;

  return (
    value.kind === DIRECT_MESSAGE_KIND &&
    value.version === DIRECT_MESSAGE_VERSION &&
    isDirectMessageRecord(value.record)
  );
}

function hasRecordBase(value: unknown): value is Record<string, unknown> {
  return (
    isObject(value) &&
    typeof value.authorId === 'string' &&
    typeof value.conversationId === 'string' &&
    typeof value.createdAt === 'number' &&
    typeof value.id === 'string'
  );
}

function isSentFields(value: Record<string, unknown>): boolean {
  return (
    typeof value.encryptedPayload === 'string' &&
    isStringArray(value.previousMessageIds) &&
    (value.replyToMessageId === undefined ||
      typeof value.replyToMessageId === 'string')
  );
}

function isEditedFields(value: Record<string, unknown>): boolean {
  return (
    typeof value.encryptedPayload === 'string' &&
    isStringArray(value.previousMessageIds) &&
    typeof value.targetMessageId === 'string'
  );
}

function isReactionFields(value: Record<string, unknown>): boolean {
  return (
    (value.action === 'add' || value.action === 'remove') &&
    typeof value.emoji === 'string' &&
    typeof value.targetMessageId === 'string'
  );
}

function isPinFields(value: Record<string, unknown>): boolean {
  return (
    (value.action === 'pin' || value.action === 'unpin') &&
    typeof value.targetMessageId === 'string'
  );
}

function isDirectMessageRecord(value: unknown): value is DirectMessageRecord {
  if (!hasRecordBase(value)) return false;

  switch (value.type) {
    case 'sent':
      return isSentFields(value);
    case 'edited':
      return isEditedFields(value);
    case 'deleted':
      return typeof value.targetMessageId === 'string';
    case 'read':
      return typeof value.targetMessageId === 'string';
    case 'reaction':
      return isReactionFields(value);
    case 'pin':
      return isPinFields(value);
    default:
      return false;
  }
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
