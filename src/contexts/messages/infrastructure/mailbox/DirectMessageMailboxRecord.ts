import type { MessageResource } from '../http/MessageResource';

/**
 * Fields the recipient needs to decrypt and place one direct text message.
 * Identical to the legacy record, so the same message id dedupes across paths.
 */
export type DirectTextMailboxRecord = {
  authorId: string;
  conversationId: string;
  createdAt: number;
  encryptedPayload: string;
  id: string;
  previousMessageIds: string[];
};

const DIRECT_TEXT_KIND = 'direct-text';
const DIRECT_TEXT_VERSION = 1;

type DirectTextMailboxEnvelope = {
  kind: 'direct-text';
  record: DirectTextMailboxRecord;
  version: 1;
};

export class DirectMessageMailboxRecord {
  /** Only plain text between two participants travels through the mailbox. */
  public static isEligible(input: {
    attachmentCount: number;
    conversationType: 'group' | 'one-to-one';
    hasReply: boolean;
    hasSticker: boolean;
  }): boolean {
    return (
      input.conversationType === 'one-to-one' &&
      input.attachmentCount === 0 &&
      !input.hasReply &&
      !input.hasSticker
    );
  }

  public static fromSent(
    conversationId: string,
    sent: MessageResource,
  ): DirectTextMailboxRecord {
    const fields = DirectMessageMailboxRecord.sentFields(sent);

    if (
      !fields.id ||
      !fields.authorId ||
      !fields.encryptedPayload ||
      fields.createdAt === undefined
    ) {
      throw new Error('Sent message is missing mailbox fields.');
    }

    return {
      authorId: fields.authorId,
      conversationId,
      createdAt: fields.createdAt,
      encryptedPayload: fields.encryptedPayload,
      id: fields.id,
      previousMessageIds: fields.previousMessageIds ?? [],
    };
  }

  private static sentFields(
    sent: MessageResource,
  ): Partial<DirectTextMailboxRecord> {
    return {
      authorId: sent.authorId ?? sent.authorIdentityId,
      createdAt: sent.createdAt ?? sent.timestamp,
      encryptedPayload: sent.encryptedPayload ?? sent.payload,
      id: sent.id,
      previousMessageIds: sent.previousMessageIds,
    };
  }

  public static encode(record: DirectTextMailboxRecord): Uint8Array {
    const envelope: DirectTextMailboxEnvelope = {
      kind: DIRECT_TEXT_KIND,
      record,
      version: DIRECT_TEXT_VERSION,
    };

    return new TextEncoder().encode(JSON.stringify(envelope));
  }

  /**
   * Returns the message resource for the projection, or null for anything
   * that is not a direct-text record for this conversation. Callers skip null
   * and still acknowledge, so a bad envelope cannot stall the inbox.
   */
  public static decode(
    plaintext: Uint8Array,
    conversationId: string,
  ): MessageResource | null {
    let parsed: unknown;

    try {
      parsed = JSON.parse(new TextDecoder().decode(plaintext));
    } catch {
      return null;
    }

    if (!isDirectTextEnvelope(parsed)) return null;

    const { record } = parsed;

    if (record.conversationId !== conversationId) return null;

    return {
      authorId: record.authorId,
      conversationId: record.conversationId,
      createdAt: record.createdAt,
      encryptedPayload: record.encryptedPayload,
      id: record.id,
      previousMessageIds: record.previousMessageIds,
      type: 'sent',
    };
  }
}

function isDirectTextEnvelope(
  value: unknown,
): value is DirectTextMailboxEnvelope {
  if (!isObject(value)) return false;

  return (
    value.kind === DIRECT_TEXT_KIND &&
    value.version === DIRECT_TEXT_VERSION &&
    isDirectTextRecord(value.record)
  );
}

function isDirectTextRecord(value: unknown): value is DirectTextMailboxRecord {
  if (!isObject(value)) return false;

  return (
    typeof value.authorId === 'string' &&
    typeof value.conversationId === 'string' &&
    typeof value.createdAt === 'number' &&
    typeof value.encryptedPayload === 'string' &&
    typeof value.id === 'string' &&
    Array.isArray(value.previousMessageIds) &&
    value.previousMessageIds.every((id) => typeof id === 'string')
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
