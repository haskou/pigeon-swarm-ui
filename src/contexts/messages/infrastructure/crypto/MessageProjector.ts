import type { MessageListEnvelope } from '../http/MessageListEnvelope';
import type { MessageProjectionCopy } from './MessageProjectionCopy';
import type { MessageReactionRecord } from './MessageReactionRecord';
import type { PlainMessage } from './PlainMessage';
import type { ProjectedMessage } from './ProjectedMessage';

export type { MessageProjectionCopy } from './MessageProjectionCopy';
/* eslint-disable @typescript-eslint/no-use-before-define */
import { EncryptedPayload, SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../identities/infrastructure/session/Session';
import type { ChatMessage } from '../../domain/ChatMessage';
import type { MessageReaction } from '../http/MessageReaction';
import type { MessageResource } from '../http/MessageResource';

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
  ): ProjectedMessage {
    try {
      const decrypted = symmetricKey.decrypt(
        new EncryptedPayload(encryptedPayload),
      );
      const decryptedText = decrypted.toString();
      const parsed = JSON.parse(decryptedText) as PlainMessage;

      return {
        message: this.projectDecrypted(
          base,
          message,
          decryptedText,
          parsed,
          currentIdentityId,
        ),
        readable: true,
      };
    } catch {
      return {
        message: this.encryptedError(base, message, 'decrypt-failed'),
        readable: false,
      };
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

  /**
   * Projects a record whose payload is the plain message JSON, as it travels
   * inside an MLS application message. The record's author, whom MLS
   * authenticated, is the only author: a payload naming another identity, or
   * one that does not parse, is unreadable.
   */
  public projectPlaintext(
    session: Session,
    message: MessageResource,
  ): ProjectedMessage {
    const base = this.baseMessage(session, message);
    const unreadable: ProjectedMessage = {
      message: this.encryptedError(base, message, 'decrypt-failed'),
      readable: false,
    };

    try {
      const text = message.encryptedPayload ?? '';
      const parsed = JSON.parse(text) as PlainMessage;

      if (parsed.authorIdentityId !== base.authorIdentityId) return unreadable;

      return {
        message: this.projectDecrypted(
          base,
          message,
          text,
          parsed,
          session.identity.id,
        ),
        readable: true,
      };
    } catch {
      return unreadable;
    }
  }

  public list(value: unknown): {
    messages: MessageResource[];
    nextCursor?: null | string;
  } {
    const envelope = value as Partial<MessageListEnvelope> | null;

    if (!Array.isArray(envelope?.messages)) {
      throw new TypeError('Messages response requires a messages list.');
    }

    return {
      messages: envelope.messages,
      nextCursor: envelope.nextBeforeMessageId ?? null,
    };
  }

  /** Projects one resource and reports whether its payload could be read. */
  public project(
    session: Session,
    conversationId: string,
    message: MessageResource,
  ): ProjectedMessage {
    const pollMessage = PollMessageProjection.toChatMessage(
      message,
      session.identity.id,
    );

    if (pollMessage) return { message: pollMessage, readable: true };

    const base = this.baseMessage(session, message);

    if (message.type === 'call_event') {
      return { message: this.callEventMessage(base, message), readable: true };
    }

    const encryptedPayload = message.encryptedPayload ?? message.payload;

    if (!encryptedPayload) {
      return { message: this.plainMessage(base, message), readable: true };
    }

    const key = this.conversationKey(session, conversationId);

    if (!key) {
      return {
        message: this.encryptedError(base, message, 'missing-key'),
        readable: false,
      };
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
