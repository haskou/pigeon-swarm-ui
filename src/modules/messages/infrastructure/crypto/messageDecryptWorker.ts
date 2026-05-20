/* eslint-disable @typescript-eslint/no-use-before-define */
import { EncryptedPayload, PrivateKey } from '@haskou/value-objects';

import type {
  ChatMessage,
  MessageAttachment,
  MessageLinkPreview,
  MessageReaction,
  MessageReplyPreview,
  MessageResource,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';

import { pollChatMessage } from '../../domain/pollMessageProjection';

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
  linkPreview?: MessageLinkPreview;
  reply?: MessageReplyPreview;
  sticker?: StickerMessageReference;
  timestamp?: number;
  type?: string;
};

const cancelledRequestIds = new Set<number>();
const projectedMessageCache = new Map<string, ChatMessage>();
const projectedMessageCacheLimit = 500;
const persistentProjectedMessageCacheLimit = 2000;
const projectedMessageCacheDatabaseName = 'pigeon-message-projection-cache';
const projectedMessageCacheDatabaseVersion = 3;
const projectedMessageCacheStoreName = 'projectedMessages';
const messageDecryptBatchSize = 8;
let projectedMessageCacheDatabasePromise: Promise<IDBDatabase | null> | null =
  null;

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
  const pollMessage = pollChatMessage(message, request.currentIdentityId);

  if (pollMessage) return pollMessage;

  const cacheKey = projectedMessageCacheKey(request, message);
  const cachedMessage = await cachedProjectedMessage(cacheKey);

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

  rememberProjectedMessage(cacheKey, projectedMessage);

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
      linkPreview: parsed.linkPreview,
      mine: authorIdentityId === request.currentIdentityId,
      raw: message,
      replyPreview: parsed.reply,
      replyToMessageId: base.replyToMessageId ?? parsed.reply?.messageId,
      sticker: parsed.sticker,
      timestamp: parsed.timestamp ?? base.timestamp,
    };
  } catch {
    return encryptedError(base, message, request.copy.decryptFailed);
  }
}

async function cachedProjectedMessage(
  cacheKey: string,
): Promise<ChatMessage | undefined> {
  const cachedMessage = projectedMessageCache.get(cacheKey);

  if (cachedMessage) return cloneChatMessage(cachedMessage);

  const persistentMessage = await readPersistentProjectedMessage(cacheKey);

  if (!persistentMessage) return undefined;

  rememberProjectedMessageInMemory(cacheKey, persistentMessage);

  return cloneChatMessage(persistentMessage);
}

function rememberProjectedMessage(
  cacheKey: string,
  projectedMessage: ChatMessage,
): void {
  if (!shouldCacheProjectedMessage(projectedMessage)) return;

  rememberProjectedMessageInMemory(cacheKey, projectedMessage);
  void writePersistentProjectedMessage(cacheKey, projectedMessage);
}

function rememberProjectedMessageInMemory(
  cacheKey: string,
  projectedMessage: ChatMessage,
): void {
  projectedMessageCache.set(cacheKey, cloneChatMessage(projectedMessage));

  if (projectedMessageCache.size <= projectedMessageCacheLimit) return;

  const oldestKey = projectedMessageCache.keys().next().value;

  if (oldestKey) projectedMessageCache.delete(oldestKey);
}

function shouldCacheProjectedMessage(message: ChatMessage): boolean {
  return !message.encrypted;
}

function projectedMessageCacheKey(
  request: MessageDecryptRequest,
  message: MessageResource,
): string {
  return [
    request.currentIdentityId,
    request.conversationId,
    request.privateKey ? 'keyed' : 'no-key',
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

async function readPersistentProjectedMessage(
  cacheKey: string,
): Promise<ChatMessage | undefined> {
  const database = await projectedMessageCacheDatabase();

  if (!database) return undefined;

  return await new Promise<ChatMessage | undefined>((resolve) => {
    const transaction = database.transaction(
      projectedMessageCacheStoreName,
      'readonly',
    );
    const request = transaction
      .objectStore(projectedMessageCacheStoreName)
      .get(cacheKey);

    request.onsuccess = () => {
      const record = request.result as { message?: ChatMessage } | undefined;

      resolve(record?.message ? cloneChatMessage(record.message) : undefined);
    };
    request.onerror = () => resolve(undefined);
  });
}

async function writePersistentProjectedMessage(
  cacheKey: string,
  message: ChatMessage,
): Promise<void> {
  const database = await projectedMessageCacheDatabase();

  if (!database) return;

  await new Promise<void>((resolve) => {
    const transaction = database.transaction(
      projectedMessageCacheStoreName,
      'readwrite',
    );
    const store = transaction.objectStore(projectedMessageCacheStoreName);

    store.put({
      cacheKey,
      lastAccessedAt: Date.now(),
      message: cloneChatMessage(message),
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });

  void prunePersistentProjectedMessages(database);
}

async function prunePersistentProjectedMessages(
  database: IDBDatabase,
): Promise<void> {
  await new Promise<void>((resolve) => {
    const transaction = database.transaction(
      projectedMessageCacheStoreName,
      'readwrite',
    );
    const store = transaction.objectStore(projectedMessageCacheStoreName);
    const countRequest = store.count();

    countRequest.onsuccess = () => {
      const extraCount =
        countRequest.result - persistentProjectedMessageCacheLimit;

      if (extraCount <= 0) return;

      const index = store.index('lastAccessedAt');
      const cursorRequest = index.openCursor();
      let deletedCount = 0;

      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;

        if (!cursor || deletedCount >= extraCount) return;

        cursor.delete();
        deletedCount += 1;
        cursor.continue();
      };
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
}

async function projectedMessageCacheDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return null;

  projectedMessageCacheDatabasePromise ??= openProjectedMessageCacheDatabase();

  return await projectedMessageCacheDatabasePromise;
}

// eslint-disable-next-line max-len
async function openProjectedMessageCacheDatabase(): Promise<IDBDatabase | null> {
  return await new Promise<IDBDatabase | null>((resolve) => {
    const request = indexedDB.open(
      projectedMessageCacheDatabaseName,
      projectedMessageCacheDatabaseVersion,
    );

    request.onupgradeneeded = (event) => {
      const database = request.result;
      const store = database.objectStoreNames.contains(
        projectedMessageCacheStoreName,
      )
        ? request.transaction?.objectStore(projectedMessageCacheStoreName)
        : database.createObjectStore(projectedMessageCacheStoreName, {
            keyPath: 'cacheKey',
          });

      if (store && !store.indexNames.contains('lastAccessedAt')) {
        store.createIndex('lastAccessedAt', 'lastAccessedAt');
      }

      if (store && event.oldVersion < 2) {
        store.clear();
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function cloneChatMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    attachments: [...message.attachments],
    linkPreview: message.linkPreview ? { ...message.linkPreview } : undefined,
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
