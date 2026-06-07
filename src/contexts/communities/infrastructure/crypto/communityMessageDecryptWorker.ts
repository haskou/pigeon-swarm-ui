/* eslint-disable @typescript-eslint/no-use-before-define */
import { EncryptedPayload, PrivateKey } from '@haskou/value-objects';

import type {
  ChatMessage,
  ConversationKeyEntry,
  MessageReaction,
  MessageResource,
} from '../../../../shared/domain/pigeonResources.types';
import type { CacheDatabase } from './communityMessageDecryptWorker/CacheDatabase';
import type { CommunityChannelPlainPayload } from './communityMessageDecryptWorker/CommunityChannelPlainPayload';
import type { CommunityMessageDecryptCancelRequest } from './communityMessageDecryptWorker/CommunityMessageDecryptCancelRequest';
import type { CommunityMessageDecryptRequest } from './communityMessageDecryptWorker/CommunityMessageDecryptRequest';
import type { CommunityMessageDecryptResponse } from './communityMessageDecryptWorker/CommunityMessageDecryptResponse';
import type { MessageReactionRecord } from './communityMessageDecryptWorker/MessageReactionRecord';

import { PollMessageProjection } from '../../../messages/domain/PollMessageProjection';

const cancelledRequestIds = new Set<number>();
const projectedMessageCache = new Map<string, ChatMessage>();
const projectedMessageCacheLimit = 500;
const persistentProjectedMessageCacheLimit = 2000;
const projectedMessageCacheDatabaseName =
  'pigeon-community-message-projection-cache';
const projectedMessageCacheDatabaseVersion = 3;
const projectedMessageCacheStoreName = 'projectedMessages';
const messageDecryptBatchSize = 8;
let projectedMessageCacheDatabasePromise: Promise<CacheDatabase> | null = null;

function isCancelRequest(
  request:
    | CommunityMessageDecryptCancelRequest
    | CommunityMessageDecryptRequest,
): request is CommunityMessageDecryptCancelRequest {
  return 'type' in request && request.type === 'cancel';
}

async function projectMessages(
  request: CommunityMessageDecryptRequest,
): Promise<ChatMessage[]> {
  const projectedMessages = new Array<ChatMessage>(request.messages.length);

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
      indexes.map((index) => projectMessage(request, request.messages[index])),
    );

    for (let index = 0; index < indexes.length; index += 1) {
      projectedMessages[indexes[index]] = batch[index];
    }
  }

  return projectedMessages;
}

async function projectMessage(
  request: CommunityMessageDecryptRequest,
  message: MessageResource,
): Promise<ChatMessage> {
  const pollMessage = PollMessageProjection.toChatMessage(
    message,
    request.currentIdentityId,
  );

  if (pollMessage) return pollMessage;

  const cacheKey = projectedMessageCacheKey(request, message);
  const cachedMessage = await cachedProjectedMessage(cacheKey);

  if (cachedMessage) return cachedMessage;

  const base = baseMessage(request.currentIdentityId, message);
  let projectedMessage: ChatMessage;

  if (message.type === 'call_event') {
    projectedMessage = callEventMessage(base, message);
  } else if (message.plaintextPayload !== undefined) {
    projectedMessage = plaintextMessage(
      request,
      base,
      message,
      message.plaintextPayload,
    );
  } else if (!message.encryptedPayload) {
    projectedMessage = encryptedError(base, message, request.copy.missingKey);
  } else if (!request.communityKey) {
    projectedMessage = encryptedError(base, message, request.copy.missingKey);
  } else {
    projectedMessage = await decryptMessage(
      request,
      base,
      message,
      message.encryptedPayload,
      request.communityKey,
    );
  }

  rememberProjectedMessage(cacheKey, projectedMessage);

  return projectedMessage;
}

function plaintextMessage(
  request: CommunityMessageDecryptRequest,
  base: Omit<ChatMessage, 'content' | 'encrypted'>,
  message: MessageResource,
  plaintextPayload: string,
): ChatMessage {
  const payload = parseCommunityChannelPlainPayload(plaintextPayload);
  const authorIdentityId = payload.authorIdentityId ?? base.authorIdentityId;
  const isEdited = isEditedCommunityChannelMessage(payload, message);

  return {
    ...base,
    attachments: payload.attachments ?? [],
    authorIdentityId,
    content: communityChannelMessageContent(payload),
    edited: base.edited || isEdited,
    editedAt: communityChannelMessageEditedAt(base, payload, isEdited),
    encrypted: false,
    linkPreview: payload.linkPreview,
    mentions: payload.mentions ?? message.mentions,
    mine: authorIdentityId === request.currentIdentityId,
    raw: message,
    replyPreview: payload.reply,
    replyToMessageId: payload.replyToMessageId ?? base.replyToMessageId,
    sticker: payload.sticker,
    threadRootMessageId: threadRootMessageIdFromPayload(payload, base),
    timestamp: communityChannelMessageTimestamp(base, payload, isEdited),
  };
}

async function decryptMessage(
  request: CommunityMessageDecryptRequest,
  base: Omit<ChatMessage, 'content' | 'encrypted'>,
  message: MessageResource,
  encryptedPayload: string,
  communityKey: ConversationKeyEntry,
): Promise<ChatMessage> {
  try {
    const payload = await decryptCommunityChannelPayload(
      encryptedPayload,
      communityKey,
    );
    const authorIdentityId = payload.authorIdentityId ?? base.authorIdentityId;
    const isEdited = isEditedCommunityChannelMessage(payload, message);

    return {
      ...base,
      attachments: payload.attachments ?? [],
      authorIdentityId,
      content: communityChannelMessageContent(payload),
      edited: base.edited || isEdited,
      editedAt: communityChannelMessageEditedAt(base, payload, isEdited),
      encrypted: false,
      linkPreview: payload.linkPreview,
      mentions: payload.mentions ?? message.mentions,
      mine: authorIdentityId === request.currentIdentityId,
      raw: message,
      replyPreview: payload.reply,
      replyToMessageId: payload.replyToMessageId ?? base.replyToMessageId,
      sticker: payload.sticker,
      threadRootMessageId: threadRootMessageIdFromPayload(payload, base),
      timestamp: communityChannelMessageTimestamp(base, payload, isEdited),
    };
  } catch {
    return encryptedError(base, message, request.copy.decryptFailed);
  }
}

function threadRootMessageIdFromPayload(
  payload: CommunityChannelPlainPayload,
  base: Omit<ChatMessage, 'content' | 'encrypted'>,
): string | undefined {
  if (payload.threadRootMessageId) return payload.threadRootMessageId;

  if (
    payload.type === 'CommunityChannelThreadMessageSent' ||
    payload.type === 'CommunityChannelThreadStickerMessageSent'
  ) {
    return payload.replyToMessageId ?? base.replyToMessageId;
  }

  return undefined;
}

function isEditedCommunityChannelMessage(
  payload: CommunityChannelPlainPayload,
  message: MessageResource,
): boolean {
  if (payload.type === 'CommunityChannelMessageEdited') return true;

  if (message.type === 'edited') return true;

  return typeof message.editedAt === 'number';
}

function communityChannelMessageContent(
  payload: CommunityChannelPlainPayload,
): string {
  if (payload.sticker) return '';

  return payload.content ?? '';
}

function communityChannelMessageEditedAt(
  base: Omit<ChatMessage, 'content' | 'encrypted'>,
  payload: CommunityChannelPlainPayload,
  isEdited: boolean,
): number | undefined {
  if (typeof base.editedAt === 'number') return base.editedAt;

  if (!isEdited) return undefined;

  return payload.timestamp;
}

function communityChannelMessageTimestamp(
  base: Omit<ChatMessage, 'content' | 'encrypted'>,
  payload: CommunityChannelPlainPayload,
  isEdited: boolean,
): number {
  if (isEdited) return base.timestamp;

  return payload.timestamp ?? base.timestamp;
}

function parseCommunityChannelPlainPayload(
  plaintextPayload: string,
): CommunityChannelPlainPayload {
  try {
    const parsed = JSON.parse(plaintextPayload) as unknown;

    if (isRecord(parsed)) return parsed as CommunityChannelPlainPayload;
  } catch {
    return { content: plaintextPayload };
  }

  return { content: plaintextPayload };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function decryptCommunityChannelPayload(
  encryptedPayload: string,
  communityKey: ConversationKeyEntry,
): Promise<CommunityChannelPlainPayload> {
  const decrypted = await PrivateKey.fromPEM(communityKey.privateKey).decrypt(
    new EncryptedPayload(encryptedPayload),
  );

  return JSON.parse(decrypted.toString()) as CommunityChannelPlainPayload;
}

function baseMessage(
  currentIdentityId: string,
  message: MessageResource,
): Omit<ChatMessage, 'content' | 'encrypted'> {
  const authorIdentityId =
    message.authorIdentityId ?? message.actorIdentityId ?? currentIdentityId;
  const reactions = normalizeMessageReactions(message.reactions);

  return {
    attachments: [],
    authorIdentityId,
    edited: typeof message.editedAt === 'number',
    editedAt: message.editedAt,
    id: message.id ?? `${message.createdAt ?? Date.now()}`,
    mine: authorIdentityId === currentIdentityId,
    raw: { ...message, reactions },
    reactions,
    replyToMessageId: message.replyToMessageId,
    timestamp: message.createdAt ?? message.timestamp ?? Date.now(),
  };
}

function callEventMessage(
  base: Omit<ChatMessage, 'content' | 'encrypted'>,
  message: MessageResource,
): ChatMessage {
  return {
    ...base,
    content: '',
    encrypted: false,
    kind: 'call-event',
    raw: message,
  };
}

function encryptedError(
  base: Omit<ChatMessage, 'content' | 'encrypted'>,
  message: MessageResource,
  content: string,
): ChatMessage {
  return {
    ...base,
    authorIdentityId: message.authorIdentityId ?? base.authorIdentityId,
    content,
    encrypted: true,
    raw: message,
  };
}

function normalizeMessageReactions(
  reactions: MessageResource['reactions'],
): MessageReaction[] {
  if (!Array.isArray(reactions)) return [];

  return reactions
    .map((reaction): MessageReaction | null => {
      const record = reaction as MessageReactionRecord;
      const authorIdentityId =
        typeof record.authorIdentityId === 'string'
          ? record.authorIdentityId
          : typeof record.authorId === 'string'
            ? record.authorId
            : '';
      const emoji = typeof record.emoji === 'string' ? record.emoji : '';

      if (!authorIdentityId || !emoji) return null;

      return {
        authorIdentityId,
        createdAt:
          typeof record.createdAt === 'number' ? record.createdAt : Date.now(),
        emoji,
      };
    })
    .filter((reaction): reaction is MessageReaction => Boolean(reaction));
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
  request: CommunityMessageDecryptRequest,
  message: MessageResource,
): string {
  return [
    request.currentIdentityId,
    request.communityId,
    request.channelId,
    request.communityKey?.conversationId ?? 'no-key',
    firstCachePart(message.id, message.messageId),
    firstCachePart(
      message.encryptedPayload,
      message.plaintextPayload,
      message.payload,
      message.content,
    ),
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

async function projectedMessageCacheDatabase(): Promise<CacheDatabase> {
  if (typeof indexedDB === 'undefined') return null;

  projectedMessageCacheDatabasePromise ??= openProjectedMessageCacheDatabase();

  return await projectedMessageCacheDatabasePromise;
}

async function openProjectedMessageCacheDatabase(): Promise<CacheDatabase> {
  return await new Promise<CacheDatabase>((resolve) => {
    const request = indexedDB.open(
      projectedMessageCacheDatabaseName,
      projectedMessageCacheDatabaseVersion,
    );

    request.onupgradeneeded = () => {
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
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function cloneChatMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    attachments: message.attachments.map((attachment) => ({ ...attachment })),
    linkPreview: message.linkPreview ? { ...message.linkPreview } : undefined,
    raw: {
      ...message.raw,
      reactions: message.raw.reactions?.map((reaction) => ({ ...reaction })),
    },
    reactions: message.reactions.map((reaction) => ({ ...reaction })),
    replyPreview: message.replyPreview
      ? {
          ...message.replyPreview,
          image: message.replyPreview.image
            ? { ...message.replyPreview.image }
            : undefined,
          sticker: message.replyPreview.sticker
            ? { ...message.replyPreview.sticker }
            : undefined,
        }
      : undefined,
    sticker: message.sticker ? { ...message.sticker } : undefined,
  };
}

function postResponse(response: CommunityMessageDecryptResponse): void {
  self.postMessage(response);
}

self.onmessage = async (
  event: MessageEvent<
    CommunityMessageDecryptCancelRequest | CommunityMessageDecryptRequest
  >,
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
        caught instanceof Error
          ? caught.message
          : 'Community message decrypt failed',
      requestId: request.requestId,
      type: 'error',
    });
  }
};
