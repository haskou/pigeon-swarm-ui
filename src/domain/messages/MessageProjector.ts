import { EncryptedPayload, PrivateKey } from '@haskou/value-objects';

import type { ChatMessage, MessageResource, Session } from '../types';

type MessageListEnvelope = {
  cursor?: string | null;
  data?: MessageResource[];
  items?: MessageResource[];
  messages?: MessageResource[];
  nextBeforeMessageId?: string | null;
  nextCursor?: string | null;
};

type PlainMessage = {
  authorIdentityId?: string;
  content?: string;
  timestamp?: number;
};

export class MessageProjector {
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
    const encryptedPayload = message.encryptedPayload ?? message.payload;

    if (!encryptedPayload) {
      return this.plainMessage(base, message);
    }

    const key = session.keychain.conversations[conversationId];

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
    const authorIdentityId = message.authorIdentityId ?? 'unknown';

    return {
      authorIdentityId,
      id:
        message.id ??
        message.messageId ??
        `${message.timestamp ?? Date.now()}-${Math.random()}`,
      mine: authorIdentityId === session.identity.id,
      raw: message,
      timestamp: message.timestamp ?? message.createdAt ?? Date.now(),
    };
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
      reason === 'missing-key'
        ? '[encrypted] Falta la clave privada de esta conversación en el keychain.'
        : '[encrypted] No se ha podido desencriptar este evento. Qué sorpresa, la criptografía exige llaves correctas.';

    return { ...base, content, encrypted: true, raw: message };
  }

  private plainMessage(
    base: Omit<ChatMessage, 'content' | 'encrypted'>,
    message: MessageResource,
  ): ChatMessage {
    return {
      ...base,
      content: message.content ?? '',
      encrypted: false,
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
      authorIdentityId,
      content: parsed.content ?? decryptedText,
      encrypted: false,
      mine: authorIdentityId === currentIdentityId,
      raw: message,
      timestamp: parsed.timestamp ?? base.timestamp,
    };
  }
}
