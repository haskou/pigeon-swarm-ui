/* eslint-disable @typescript-eslint/no-use-before-define */
import { EncryptedPayload, PrivateKey } from '@haskou/value-objects';

import type {
  ChatMessage,
  CommunityMessageMention,
  MessageLinkPreview,
  MessageAttachment,
  MessageReaction,
  MessageResource,
  MessageReplyPreview,
  Session,
  StickerMessageReference,
} from '../types';

import { conversationKeyEntry } from '../conversations/conversationKey';
import { pollChatMessage } from './pollMessageProjection';

type MessageListEnvelope = {
  cursor?: string | null;
  data?: MessageResource[];
  items?: MessageResource[];
  messages?: MessageResource[];
  nextBeforeMessageId?: string | null;
  nextCursor?: string | null;
};

type PlainMessage = {
  attachments?: MessageAttachment[];
  authorIdentityId?: string;
  content?: string;
  linkPreview?: MessageLinkPreview;
  mentions?: CommunityMessageMention[];
  reply?: MessageReplyPreview;
  sticker?: StickerMessageReference;
  timestamp?: number;
  type?: string;
};

export type MessageProjectionCopy = {
  decryptFailed: string;
  missingKey: string;
};

type MessageReactionRecord = {
  authorId?: unknown;
  authorIdentityId?: unknown;
  createdAt?: unknown;
  emoji?: unknown;
};

export class MessageProjector {
  private readonly privateKeys = new Map<
    string,
    ReturnType<typeof PrivateKey.fromPEM>
  >();

  public constructor(private readonly copy: MessageProjectionCopy) {}

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

  public async toChatMessage(
    session: Session,
    conversationId: string,
    message: MessageResource,
  ): Promise<ChatMessage> {
    const pollMessage = pollChatMessage(message, session.identity.id);

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

    return await this.decryptMessage(
      base,
      message,
      encryptedPayload,
      this.privateKey(key.privateKey),
      session.identity.id,
    );
  }

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
    return conversationKeyEntry(
      session.keychain,
      session.identity.id,
      conversationId,
    );
  }

  private privateKey(
    privateKey: string,
  ): ReturnType<typeof PrivateKey.fromPEM> {
    const cachedPrivateKey = this.privateKeys.get(privateKey);

    if (cachedPrivateKey) return cachedPrivateKey;

    const nextPrivateKey = PrivateKey.fromPEM(privateKey);

    this.privateKeys.set(privateKey, nextPrivateKey);

    return nextPrivateKey;
  }

  private async decryptMessage(
    base: Omit<ChatMessage, 'content' | 'encrypted'>,
    message: MessageResource,
    encryptedPayload: string,
    privateKey: ReturnType<typeof PrivateKey.fromPEM>,
    currentIdentityId: string,
  ): Promise<ChatMessage> {
    try {
      const decrypted = await privateKey.decrypt(
        new EncryptedPayload(encryptedPayload),
      );
      const decryptedText = new TextDecoder().decode(decrypted);
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
      timestamp: parsed.timestamp ?? base.timestamp,
    };
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
