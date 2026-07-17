import type { MessageListEnvelope } from '../http/MessageListEnvelope';
import type { MessageProjectionCopy } from './MessageProjectionCopy';
import type { MessageReactionRecord } from './MessageReactionRecord';
import type { PlainMessage } from './PlainMessage';

export type { MessageProjectionCopy } from './MessageProjectionCopy';
/* eslint-disable @typescript-eslint/no-use-before-define */
import { EncryptedPayload, SymmetricKey } from '@haskou/value-objects';

import type {
  ChatMessage,
  MessageReaction,
  MessageResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { ConversationKeychain } from '../../../identities/infrastructure/keychain/ConversationKeychain';
import { PollMessageProjection } from './PollMessageProjection';

export class MessageProjector {
  private readonly symmetricKeys = new Map<string, SymmetricKey>();

  public constructor(private readonly copy: MessageProjectionCopy) {}

  private baseMessage(
    session: Session,
    message: MessageResource,
  ): Omit<ChatMessage, 'content' | 'encrypted'> {
    const authorIdentityId = this.authorIdentityId(message);
    const reactions = normalizeMessageReactions(message.reactions);

    return {
      attachments: [],
      authorIdentityId,
      id: this.messageId(message),
      mine: authorIdentityId === session.identity.id,
      raw: { ...message, reactions },
      reactions,
      replyToMessageId: message.replyToMessageId,
      timestamp: this.messageTimestamp(message),
    };
  }

  private authorIdentityId(message: MessageResource): string {
    return message.authorIdentityId ?? message.authorId ?? 'unknown';
  }

  private messageId(message: MessageResource): string {
    return (
      message.id ??
      message.messageId ??
      `${this.messageTimestamp(message)}-${Math.random()}`
    );
  }

  private messageTimestamp(message: MessageResource): number {
    return message.timestamp ?? message.createdAt ?? Date.now();
  }

  private conversationKey(session: Session, conversationId: string) {
    return ConversationKeychain.entry(
      session.keychain,
      session.identity.id,
      conversationId,
    );
  }

  private symmetricKey(key: string): SymmetricKey {
    const cachedSymmetricKey = this.symmetricKeys.get(key);

    if (cachedSymmetricKey) return cachedSymmetricKey;

    const nextSymmetricKey = SymmetricKey.fromBase64(key);

    this.symmetricKeys.set(key, nextSymmetricKey);

    return nextSymmetricKey;
  }

  private decryptMessage(
    base: Omit<ChatMessage, 'content' | 'encrypted'>,
    message: MessageResource,
    encryptedPayload: string,
    symmetricKey: SymmetricKey,
    currentIdentityId: string,
  ): ChatMessage {
    try {
      const decrypted = symmetricKey.decrypt(
        new EncryptedPayload(encryptedPayload),
      );
      const decryptedText = decrypted.toString();
      const parsed = JSON.parse(decryptedText) as PlainMessage;

      return this.projectDecrypted(
        base,
        message,
        decryptedText,
        parsed,
        currentIdentityId,
      );
    } catch {
      return this.encryptedError(base, message, 'decrypt-failed');
    }
  }

  private encryptedError(
    base: Omit<ChatMessage, 'content' | 'encrypted'>,
    message: MessageResource,
    reason: 'decrypt-failed' | 'missing-key',
  ): ChatMessage {
    const content =
      reason === 'missing-key' ? this.copy.missingKey : this.copy.decryptFailed;

    return { ...base, attachments: [], content, encrypted: true, raw: message };
  }

  private plainMessage(
    base: Omit<ChatMessage, 'content' | 'encrypted'>,
    message: MessageResource,
  ): ChatMessage {
    return {
      ...base,
      attachments: [],
      content: message.content ?? '',
      encrypted: false,
      mentions: message.mentions,
      raw: message,
    };
  }

  private callEventMessage(
    base: Omit<ChatMessage, 'content' | 'encrypted'>,
    message: MessageResource,
  ): ChatMessage {
    return {
      ...base,
      attachments: [],
      content: '',
      encrypted: false,
      kind: 'call-event',
      raw: message,
    };
  }

  private projectDecrypted(
    base: Omit<ChatMessage, 'content' | 'encrypted'>,
    message: MessageResource,
    decryptedText: string,
    parsed: PlainMessage,
    currentIdentityId: string,
  ): ChatMessage {
    const authorIdentityId = parsed.authorIdentityId ?? base.authorIdentityId;

    return {
      ...base,
      attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
      authorIdentityId,
      content: parsed.content ?? decryptedText,
      encrypted: false,
      linkPreview: parsed.linkPreview,
      mentions: parsed.mentions ?? message.mentions,
      mine: authorIdentityId === currentIdentityId,
      raw: message,
      replyPreview: parsed.reply,
      replyToMessageId: base.replyToMessageId ?? parsed.reply?.messageId,
      sticker: parsed.sticker,
      threadRootMessageId: this.threadRootMessageId(parsed, message),
      timestamp: parsed.timestamp ?? base.timestamp,
    };
  }

  private threadRootMessageId(
    payload: PlainMessage,
    message: MessageResource,
  ): string | undefined {
    if (payload.threadRootMessageId) return payload.threadRootMessageId;

    if (
      payload.type === 'ThreadMessageSent' ||
      payload.type === 'ThreadStickerMessageSent'
    ) {
      return message.replyToMessageId;
    }

    return undefined;
  }

  public list(value: unknown): {
    messages: MessageResource[];
    nextCursor?: null | string;
  } {
    if (Array.isArray(value)) {
      return { messages: value as MessageResource[] };
    }

    const envelope = value as MessageListEnvelope;

    return {
      messages: envelope.messages ?? envelope.items ?? envelope.data ?? [],
      nextCursor:
        envelope.nextCursor ??
        envelope.cursor ??
        envelope.nextBeforeMessageId ??
        null,
    };
  }

  public toChatMessage(
    session: Session,
    conversationId: string,
    message: MessageResource,
  ): ChatMessage {
    const pollMessage = PollMessageProjection.toChatMessage(
      message,
      session.identity.id,
    );

    if (pollMessage) return pollMessage;

    const base = this.baseMessage(session, message);

    if (message.type === 'call_event') {
      return this.callEventMessage(base, message);
    }

    const encryptedPayload = message.encryptedPayload ?? message.payload;

    if (!encryptedPayload) {
      return this.plainMessage(base, message);
    }

    const key = this.conversationKey(session, conversationId);

    if (!key) {
      return this.encryptedError(base, message, 'missing-key');
    }

    return this.decryptMessage(
      base,
      message,
      encryptedPayload,
      this.symmetricKey(key.key),
      session.identity.id,
    );
  }
}

function normalizeMessageReactions(value: unknown): MessageReaction[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((reaction): MessageReaction[] => {
    if (!reaction || typeof reaction !== 'object') return [];

    const reactionRecord = reaction as MessageReactionRecord;
    const authorIdentityId =
      typeof reactionRecord.authorIdentityId === 'string'
        ? reactionRecord.authorIdentityId
        : reactionRecord.authorId;

    if (
      typeof authorIdentityId !== 'string' ||
      typeof reactionRecord.emoji !== 'string'
    ) {
      return [];
    }

    return [
      {
        authorIdentityId,
        createdAt:
          typeof reactionRecord.createdAt === 'number'
            ? reactionRecord.createdAt
            : 0,
        emoji: reactionRecord.emoji,
      },
    ];
  });
}
