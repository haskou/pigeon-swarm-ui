import type { DirectEditedRecord } from '../../../mailboxes/domain/DirectEditedRecord';
import type { DirectMessageRecord } from '../../../mailboxes/domain/DirectMessageRecord';
import type { DirectSentRecord } from '../../../mailboxes/domain/DirectSentRecord';
import type { MessageResource } from '../http/MessageResource';

import { DirectMailboxRecordError } from '../../../mailboxes/domain/DirectMailboxRecordError';
import { DirectMailboxRecords } from '../../../mailboxes/domain/DirectMailboxRecords';

const DIRECT_MESSAGE_KIND = 'direct-message';
const DIRECT_MESSAGE_VERSION = 2;

type DirectMessageEnvelope = {
  authorTag?: string;
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
  public static fromSent(
    conversationId: string,
    sent: MessageResource,
  ): DirectSentRecord {
    const { authorId, createdAt, encryptedPayload } = mailboxFields(sent);

    if (!sent.id || !authorId || !encryptedPayload || createdAt === undefined) {
      throw new DirectMailboxRecordError(
        'Sent message is missing mailbox fields.',
      );
    }

    return DirectMailboxRecords.sent({
      authorId,
      conversationId,
      createdAt,
      encryptedPayload,
      id: sent.id,
      previousMessageIds: sent.previousMessageIds ?? [],
      replyToMessageId: sent.replyToMessageId,
    });
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
      throw new DirectMailboxRecordError(
        'Edited message is missing mailbox fields.',
      );
    }

    return DirectMailboxRecords.edited({
      authorId,
      conversationId,
      createdAt,
      encryptedPayload,
      id: edited.id,
      targetMessageId,
    });
  }

  /**
   * `authorTag` is set only on this identity's own-inbox copies. A peer copy
   * carries none, so its bytes are unchanged.
   */
  public static encode(
    record: DirectMessageRecord,
    authorTag?: string,
  ): Uint8Array {
    const envelope: DirectMessageEnvelope = {
      authorTag,
      kind: DIRECT_MESSAGE_KIND,
      record,
      version: DIRECT_MESSAGE_VERSION,
    };

    return new TextEncoder().encode(JSON.stringify(envelope));
  }

  /**
   * Returns the record for this conversation, or null for anything that is not
   * a valid version 2 direct-message record, or that `isAuthentic` rejects.
   * Callers skip null and still acknowledge, so a bad, forged or superseded
   * (version 1) envelope cannot stall the inbox.
   */
  public static decode(
    plaintext: Uint8Array,
    conversationId: string,
    isAuthentic: (
      record: DirectMessageRecord,
      authorTag: string | undefined,
    ) => boolean = () => true,
  ): DirectMessageRecord | null {
    let parsed: unknown;

    try {
      parsed = JSON.parse(new TextDecoder().decode(plaintext));
    } catch {
      return null;
    }

    if (!isDirectMessageEnvelope(parsed)) return null;

    const { authorTag, record } = parsed;

    if (record.conversationId !== conversationId) return null;

    return isAuthentic(record, authorTag) ? record : null;
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
    (value.authorTag === undefined || typeof value.authorTag === 'string') &&
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

function isPollFields(value: Record<string, unknown>): boolean {
  return (
    typeof value.allowsMultipleVotes === 'boolean' &&
    typeof value.question === 'string' &&
    Array.isArray(value.options) &&
    value.options.every(
      (option) =>
        isObject(option) &&
        typeof option.id === 'string' &&
        typeof option.text === 'string',
    )
  );
}

function isPollVoteFields(value: Record<string, unknown>): boolean {
  return (
    isStringArray(value.optionIds) && typeof value.targetPollId === 'string'
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
      return isGroupRecord(value);
  }
}

/** The records only group conversations write: polls and typing. */
function isGroupRecord(value: Record<string, unknown>): boolean {
  switch (value.type) {
    case 'poll':
      return isPollFields(value);
    case 'poll_vote':
      return isPollVoteFields(value);
    case 'poll_close':
      return typeof value.targetPollId === 'string';
    case 'typing':
      return true;
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
