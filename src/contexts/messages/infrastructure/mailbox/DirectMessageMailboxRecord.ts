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

export type DirectMessageRecord =
  | DirectDeletedRecord
  | DirectEditedRecord
  | DirectReactionRecord
  | DirectSentRecord;

const DIRECT_MESSAGE_KIND = 'direct-message';
const DIRECT_MESSAGE_VERSION = 2;

type DirectMessageEnvelope = {
  kind: typeof DIRECT_MESSAGE_KIND;
  record: DirectMessageRecord;
  version: typeof DIRECT_MESSAGE_VERSION;
};

export class DirectMessageMailboxRecord {
  /** Only one-to-one conversations travel through the mailbox. */
  public static isEligible(conversationType: 'group' | 'one-to-one'): boolean {
    return conversationType === 'one-to-one';
  }

  public static fromSent(
    conversationId: string,
    sent: MessageResource,
  ): DirectSentRecord {
    const authorId = sent.authorId ?? sent.authorIdentityId;
    const createdAt = sent.createdAt ?? sent.timestamp;
    const encryptedPayload = sent.encryptedPayload ?? sent.payload;

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
    const authorId = edited.authorId ?? edited.authorIdentityId;
    const createdAt = edited.createdAt ?? edited.timestamp;
    const encryptedPayload = edited.encryptedPayload ?? edited.payload;
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

function isDirectMessageRecord(value: unknown): value is DirectMessageRecord {
  if (!isObject(value)) return false;

  if (
    typeof value.authorId !== 'string' ||
    typeof value.conversationId !== 'string' ||
    typeof value.createdAt !== 'number' ||
    typeof value.id !== 'string'
  ) {
    return false;
  }

  switch (value.type) {
    case 'sent':
      return (
        typeof value.encryptedPayload === 'string' &&
        isStringArray(value.previousMessageIds) &&
        (value.replyToMessageId === undefined ||
          typeof value.replyToMessageId === 'string')
      );
    case 'edited':
      return (
        typeof value.encryptedPayload === 'string' &&
        isStringArray(value.previousMessageIds) &&
        typeof value.targetMessageId === 'string'
      );
    case 'deleted':
      return typeof value.targetMessageId === 'string';
    case 'reaction':
      return (
        (value.action === 'add' || value.action === 'remove') &&
        typeof value.emoji === 'string' &&
        typeof value.targetMessageId === 'string'
      );
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
