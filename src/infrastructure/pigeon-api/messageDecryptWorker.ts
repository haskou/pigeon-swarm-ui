import { EncryptedPayload, PrivateKey } from '@haskou/value-objects';

import type {
  ChatMessage,
  MessageAttachment,
  MessageReaction,
  MessageReplyPreview,
  MessageResource,
} from '../../domain/types';

type MessageDecryptRequest = {
  copy: {
    decryptFailed: string;
    missingKey: string;
  };
  currentIdentityId: string;
  messages: MessageResource[];
  privateKey?: string;
  requestId: number;
};

type MessageDecryptCancelRequest = {
  requestId: number;
  type: 'cancel';
};

type MessageDecryptResponse =
  | {
      messages: ChatMessage[];
      requestId: number;
      type: 'success';
    }
  | {
      message: string;
      requestId: number;
      type: 'error';
    };

type MessageReactionRecord = {
  authorId?: unknown;
  authorIdentityId?: unknown;
  createdAt?: unknown;
  emoji?: unknown;
};

type PlainMessage = {
  attachments?: MessageAttachment[];
  authorIdentityId?: string;
  content?: string;
  reply?: MessageReplyPreview;
  timestamp?: number;
};

const cancelledRequestIds = new Set<number>();

function isCancelRequest(
  request: MessageDecryptCancelRequest | MessageDecryptRequest,
): request is MessageDecryptCancelRequest {
  return 'type' in request && request.type === 'cancel';
}

self.onmessage = async (
  event: MessageEvent<MessageDecryptCancelRequest | MessageDecryptRequest>,
) => {
  const request = event.data;

  if (isCancelRequest(request)) {
    cancelledRequestIds.add(request.requestId);

    return;
  }

  try {
    const messages = await Promise.all(
      request.messages.map((message) => projectMessage(request, message)),
    );

    if (cancelledRequestIds.delete(request.requestId)) return;

    postResponse({
      messages,
      requestId: request.requestId,
      type: 'success',
    });
  } catch (caught) {
    if (cancelledRequestIds.delete(request.requestId)) return;

    postResponse({
      message:
        caught instanceof Error ? caught.message : 'Message decrypt failed',
      requestId: request.requestId,
      type: 'error',
    });
  }
};

async function projectMessage(
  request: MessageDecryptRequest,
  message: MessageResource,
): Promise<ChatMessage> {
  const base = baseMessage(request.currentIdentityId, message);

  if (message.type === 'call_event') {
    return callEventMessage(base, message);
  }

  const encryptedPayload = message.encryptedPayload ?? message.payload;

  if (!encryptedPayload) {
    return plainMessage(base, message);
  }

  if (!request.privateKey) {
    return encryptedError(base, message, request.copy.missingKey);
  }

  return await decryptMessage(
    request,
    base,
    message,
    encryptedPayload,
    request.privateKey,
  );
}

async function decryptMessage(
  request: MessageDecryptRequest,
  base: Omit<ChatMessage, 'content' | 'encrypted'>,
  message: MessageResource,
  encryptedPayload: string,
  privateKey: string,
): Promise<ChatMessage> {
  try {
    const decrypted = await PrivateKey.fromPEM(privateKey).decrypt(
      new EncryptedPayload(encryptedPayload),
    );
    const decryptedText = new TextDecoder().decode(decrypted);
    const parsed = JSON.parse(decryptedText) as PlainMessage;
    const authorIdentityId = parsed.authorIdentityId ?? base.authorIdentityId;

    return {
      ...base,
      attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
      authorIdentityId,
      content: parsed.content ?? decryptedText,
      encrypted: false,
      mine: authorIdentityId === request.currentIdentityId,
      raw: message,
      replyPreview: parsed.reply,
      replyToMessageId: base.replyToMessageId ?? parsed.reply?.messageId,
      timestamp: parsed.timestamp ?? base.timestamp,
    };
  } catch {
    return encryptedError(base, message, request.copy.decryptFailed);
  }
}

function baseMessage(
  currentIdentityId: string,
  message: MessageResource,
): Omit<ChatMessage, 'content' | 'encrypted'> {
  const authorIdentityId = messageAuthorIdentityId(message);
  const reactions = normalizeMessageReactions(message.reactions);

  return {
    attachments: [],
    authorIdentityId,
    id: messageId(message),
    mine: authorIdentityId === currentIdentityId,
    raw: { ...message, reactions },
    reactions,
    replyToMessageId: message.replyToMessageId,
    timestamp: messageTimestamp(message),
  };
}

function callEventMessage(
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

function plainMessage(
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

function encryptedError(
  base: Omit<ChatMessage, 'content' | 'encrypted'>,
  message: MessageResource,
  content: string,
): ChatMessage {
  return { ...base, attachments: [], content, encrypted: true, raw: message };
}

function messageAuthorIdentityId(message: MessageResource): string {
  return message.authorIdentityId ?? message.authorId ?? 'unknown';
}

function messageId(message: MessageResource): string {
  return (
    message.id ??
    message.messageId ??
    `${messageTimestamp(message)}-${Math.random()}`
  );
}

function messageTimestamp(message: MessageResource): number {
  return message.timestamp ?? message.createdAt ?? Date.now();
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

function postResponse(response: MessageDecryptResponse): void {
  self.postMessage(response);
}
