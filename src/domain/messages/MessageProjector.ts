import { EncryptedPayload, PrivateKey } from '@haskou/value-objects';

import type {
  ChatMessage,
  MessageAttachment,
  MessageResource,
  MessageReplyPreview,
  Session,
} from '../types';

import { conversationKeyEntry } from '../conversations/conversationKey';

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
  reply?: MessageReplyPreview;
  timestamp?: number;
};

export type MessageProjectionCopy = {
  decryptFailed: string;
  missingKey: string;
};

export class MessageProjector {
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
      key.privateKey,
      session.identity.id,
    );
  }

  private baseMessage(
    session: Session,
    message: MessageResource,
  ): Omit<ChatMessage, 'content' | 'encrypted'> {
    const authorIdentityId = this.authorIdentityId(message);

    return {
      attachments: [],
      authorIdentityId,
      id: this.messageId(message),
      mine: authorIdentityId === session.identity.id,
      raw: message,
      reactions: message.reactions ?? [],
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

  private async decryptMessage(
    base: Omit<ChatMessage, 'content' | 'encrypted'>,
    message: MessageResource,
    encryptedPayload: string,
    privateKey: string,
    currentIdentityId: string,
  ): Promise<ChatMessage> {
    try {
      const decrypted = await PrivateKey.fromPEM(privateKey).decrypt(
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
      mine: authorIdentityId === currentIdentityId,
      raw: message,
      replyPreview: parsed.reply,
      replyToMessageId: base.replyToMessageId ?? parsed.reply?.messageId,
      timestamp: parsed.timestamp ?? base.timestamp,
    };
  }
}
