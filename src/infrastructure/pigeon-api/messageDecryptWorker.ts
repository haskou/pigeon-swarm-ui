import { EncryptedPayload, PrivateKey } from '@haskou/value-objects';

import type {
  ChatMessage,
  MessageAttachment,
  MessageReaction,
  MessageReplyPreview,
  MessageResource,
} from '../../domain/types';

type MessageDecryptRequest = {
  conversationId: string;
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
const projectedMessageCache = new Map<string, ChatMessage>();
const projectedMessageCacheLimit = 500;
const messageDecryptBatchSize = 8;

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
    const messages = await projectMessages(request);

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

async function projectMessages(
  request: MessageDecryptRequest,
): Promise<ChatMessage[]> {
  const projectedMessages = new Array<ChatMessage>(request.messages.length);
  const privateKey = request.privateKey
    ? PrivateKey.fromPEM(request.privateKey)
    : undefined;

  for (
    let endIndex = request.messages.length;
    endIndex > 0;
    endIndex -= messageDecryptBatchSize
  ) {
    if (cancelledRequestIds.has(request.requestId)) break;

    const startIndex = Math.max(0, endIndex - messageDecryptBatchSize);
    const indexes = Array.from(
      { length: endIndex - startIndex },
      (_, offset) => startIndex + offset,
    );
    const batch = await Promise.all(
      indexes.map((index) =>
        projectMessage(request, request.messages[index], privateKey),
      ),
    );

    for (let index = 0; index < indexes.length; index += 1) {
      projectedMessages[indexes[index]] = batch[index];
    }
  }

  return projectedMessages;
}

async function projectMessage(
  request: MessageDecryptRequest,
  message: MessageResource,
  privateKey?: ReturnType<typeof PrivateKey.fromPEM>,
): Promise<ChatMessage> {
  const cachedMessage = cachedProjectedMessage(request, message);

  if (cachedMessage) return cachedMessage;

  const base = baseMessage(request.currentIdentityId, message);
  let projectedMessage: ChatMessage;

  if (message.type === 'call_event') {
    projectedMessage = callEventMessage(base, message);
  } else {
    const encryptedPayload = message.encryptedPayload ?? message.payload;

    if (!encryptedPayload) {
      projectedMessage = plainMessage(base, message);
    } else if (!privateKey) {
      projectedMessage = encryptedError(base, message, request.copy.missingKey);
    } else {
      projectedMessage = await decryptMessage(
        request,
        base,
        message,
        encryptedPayload,
        privateKey,
      );
    }
  }

  rememberProjectedMessage(request, message, projectedMessage);

  return projectedMessage;
}

async function decryptMessage(
  request: MessageDecryptRequest,
  base: Omit<ChatMessage, 'content' | 'encrypted'>,
  message: MessageResource,
  encryptedPayload: string,
  privateKey: ReturnType<typeof PrivateKey.fromPEM>,
): Promise<ChatMessage> {
  try {
    const decrypted = await privateKey.decrypt(
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

function cachedProjectedMessage(
  request: MessageDecryptRequest,
  message: MessageResource,
): ChatMessage | undefined {
  const cachedMessage = projectedMessageCache.get(
    projectedMessageCacheKey(request, message),
  );

  return cachedMessage ? cloneChatMessage(cachedMessage) : undefined;
}

function rememberProjectedMessage(
  request: MessageDecryptRequest,
  message: MessageResource,
  projectedMessage: ChatMessage,
): void {
  projectedMessageCache.set(
    projectedMessageCacheKey(request, message),
    cloneChatMessage(projectedMessage),
  );

  if (projectedMessageCache.size <= projectedMessageCacheLimit) return;

  const oldestKey = projectedMessageCache.keys().next().value;

  if (oldestKey) projectedMessageCache.delete(oldestKey);
}

function projectedMessageCacheKey(
  request: MessageDecryptRequest,
  message: MessageResource,
): string {
  return [
    request.currentIdentityId,
    request.conversationId,
    firstCachePart(message.id, message.messageId),
    firstCachePart(message.encryptedPayload, message.payload, message.content),
    firstCachePart(message.timestamp, message.createdAt),
    firstCachePart(message.replyToMessageId),
    JSON.stringify(message.reactions ?? []),
  ].join('\u0000');
}

function firstCachePart(...values: unknown[]): string {
  const value = values.find((entry) => entry !== undefined && entry !== null);

  return value === undefined || value === null ? '' : String(value);
}

function cloneChatMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    attachments: [...message.attachments],
    raw: { ...message.raw },
    reactions: [...message.reactions],
  };
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
