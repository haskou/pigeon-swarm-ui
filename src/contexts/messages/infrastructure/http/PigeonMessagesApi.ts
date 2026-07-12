import type {
  ChatMessage,
  ConversationDraft,
  ConversationDraftsResource,
  ConversationMessagePinsResource,
  MessageLinkPreview,
  MessagePin,
  MessageResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestCache } from '../../../../shared/infrastructure/http/RequestCache';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { MessageProjectionPort } from '../crypto/MessageProjectionPort';
import type { MessageLoadOptions } from './MessageLoadOptions';

import { DraftPayloadCipher } from '../crypto/DraftPayloadCipher';
import { PigeonLinkPreviewsApi } from './PigeonLinkPreviewsApi';

const readCacheTtlMs = 1500;

export class PigeonMessagesApi {
  private readonly draftPayloads: DraftPayloadCipher;

  private readonly linkPreviews: PigeonLinkPreviewsApi;

  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    private readonly requestCache: RequestCache,
    private readonly projection: MessageProjectionPort,
    draftPayloads = new DraftPayloadCipher(),
    linkPreviews = new PigeonLinkPreviewsApi(http, signer),
  ) {
    this.draftPayloads = draftPayloads;
    this.linkPreviews = linkPreviews;
  }

  private async updateReaction(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
    method: 'DELETE' | 'POST',
  ): Promise<void> {
    const path = `${this.messagePath(conversationId, messageId)}/reactions`;
    const body = { emoji };

    await this.http.request(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, method, path, body),
      method,
    });
  }

  private invalidatePins(session: Session, conversationId: string): void {
    const path = `/conversations/${encodeURIComponent(conversationId)}/pins`;
    this.requestCache.invalidateForSession(path, session);
  }

  private messagePath(conversationId: string, messageId: string): string {
    return `/conversations/${encodeURIComponent(
      conversationId,
    )}/messages/${encodeURIComponent(messageId)}`;
  }

  private messagesPath(
    conversationId: string,
    before: null | string | undefined,
    limit: number,
  ): string {
    const query = new URLSearchParams({ limit: String(limit) });

    if (before) query.set('beforeMessageId', before);

    return `/conversations/${encodeURIComponent(
      conversationId,
    )}/messages?${query.toString()}`;
  }

  public async createLinkPreview(
    session: Session,
    url: string,
  ): Promise<MessageLinkPreview> {
    return await this.linkPreviews.create(session, url);
  }

  public async decryptMessage(
    session: Session,
    conversationId: string,
    message: MessageResource,
  ): Promise<ChatMessage> {
    return await this.projection.decrypt(session, conversationId, message);
  }

  public async loadMessages(
    session: Session,
    conversationId: string,
    before?: null | string,
    limitOrOptions: MessageLoadOptions | number = 30,
  ): Promise<{ messages: ChatMessage[]; nextCursor?: null | string }> {
    const options =
      typeof limitOrOptions === 'number'
        ? { limit: limitOrOptions }
        : limitOrOptions;
    const path = this.messagesPath(conversationId, before, options.limit ?? 30);
    const raw = await this.requestCache.load(
      `GET ${path} ${session.identity.id}`,
      async () =>
        await this.http.request<unknown>(path, {
          headers: await this.signer.headers(session, 'GET', path),
          method: 'GET',
        }),
    );
    const normalized = this.projection.list(raw);

    return {
      messages: await this.projection.decryptMany(
        session,
        conversationId,
        normalized.messages,
        options.signal,
      ),
      nextCursor: normalized.nextCursor,
    };
  }

  public async loadMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<ChatMessage | null> {
    const path = this.messagePath(conversationId, messageId);
    const message = await this.http.request<MessageResource>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });

    if (message.type === 'deleted') return null;

    return await this.projection.decrypt(session, conversationId, message);
  }

  public async loadMessagesAround(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<{
    messages: ChatMessage[];
    nextCursor?: null | string;
    previousCursor?: null | string;
  }> {
    const path = `${this.messagePath(conversationId, messageId)}/around`;
    const raw = await this.http.request<{
      messages?: MessageResource[];
      nextCursor?: null | string;
      previousCursor?: null | string;
    }>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });
    const messages = await this.projection.decryptMany(
      session,
      conversationId,
      raw.messages ?? [],
    );

    return {
      messages,
      nextCursor: raw.nextCursor ?? null,
      previousCursor: raw.previousCursor ?? null,
    };
  }

  public async loadMessageThread(
    session: Session,
    conversationId: string,
    messageId: string,
    options: { limit?: number } = {},
  ): Promise<{ messages: ChatMessage[]; nextBeforeMessageId?: null | string }> {
    const path = `${this.messagePath(conversationId, messageId)}/thread`;
    const query = new URLSearchParams({
      limit: String(options.limit ?? 50),
    });
    const result = await this.http.request<{
      messages?: MessageResource[];
      nextBeforeMessageId?: null | string;
    }>(`${path}?${query.toString()}`, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });

    return {
      messages: await this.projection.decryptMany(
        session,
        conversationId,
        result.messages ?? [],
      ),
      nextBeforeMessageId: result.nextBeforeMessageId ?? null,
    };
  }

  public async listMessagePins(
    session: Session,
    conversationId: string,
  ): Promise<MessagePin[]> {
    const path = `/conversations/${encodeURIComponent(conversationId)}/pins`;

    return await this.requestCache.load(
      this.requestCache.keyForSession(path, session),
      async () => {
        const result = await this.http.request<ConversationMessagePinsResource>(
          path,
          {
            headers: await this.signer.headers(session, 'GET', path),
            method: 'GET',
          },
        );
        const messages = await this.projection.decryptMany(
          session,
          conversationId,
          result.pins.map((pin) => pin.message),
        );

        return result.pins.map((pin, index) => ({
          ...pin,
          message: messages[index],
        }));
      },
      { ttlMs: readCacheTtlMs },
    );
  }

  public async pinMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    const path = `${this.messagePath(conversationId, messageId)}/pin`;

    await this.http.request(path, {
      headers: await this.signer.headers(session, 'POST', path),
      method: 'POST',
    });
    this.invalidatePins(session, conversationId);
  }

  public async unpinMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    const path = `${this.messagePath(conversationId, messageId)}/pin`;

    await this.http.request(path, {
      headers: await this.signer.headers(session, 'DELETE', path),
      method: 'DELETE',
    });
    this.invalidatePins(session, conversationId);
  }

  public async listConversationDrafts(
    session: Session,
  ): Promise<ConversationDraft[]> {
    const path = '/conversations/me/drafts';

    return await this.requestCache.load(
      this.requestCache.keyForSession(path, session),
      async () => {
        const result = await this.http.request<ConversationDraftsResource>(
          path,
          {
            headers: await this.signer.headers(session, 'GET', path),
            method: 'GET',
          },
        );

        return await Promise.all(
          result.drafts.map(async (draft) => ({
            ...draft,
            content: await this.draftPayloads.decrypt(
              session,
              draft.encryptedPayload,
            ),
          })),
        );
      },
      { ttlMs: readCacheTtlMs },
    );
  }

  public async saveConversationDraft(
    session: Session,
    conversationId: string,
    content: string,
    updatedAt = Date.now(),
  ): Promise<ConversationDraft> {
    const path = `/conversations/${encodeURIComponent(conversationId)}/draft`;
    const encryptedPayload = this.draftPayloads.encrypt(session, content);
    const body = { encryptedPayload, updatedAt };
    const draft = await this.http.request<Omit<ConversationDraft, 'content'>>(
      path,
      {
        body: JSON.stringify(body),
        headers: await this.signer.headers(session, 'PUT', path, body),
        method: 'PUT',
      },
    );
    this.requestCache.invalidateForSession('/conversations/me/drafts', session);

    return { ...draft, content };
  }

  public async deleteConversationDraft(
    session: Session,
    conversationId: string,
  ): Promise<void> {
    const path = `/conversations/${encodeURIComponent(conversationId)}/draft`;

    await this.http.request(path, {
      headers: await this.signer.headers(session, 'DELETE', path),
      method: 'DELETE',
    });
    this.requestCache.invalidateForSession('/conversations/me/drafts', session);
  }

  public async addMessageReaction(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.updateReaction(
      session,
      conversationId,
      messageId,
      emoji,
      'POST',
    );
  }

  public async removeMessageReaction(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.updateReaction(
      session,
      conversationId,
      messageId,
      emoji,
      'DELETE',
    );
  }
}
