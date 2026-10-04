import type {
  ChatMessage,
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
import type { ConversationDraftResource } from './ConversationDraftResource';
import type { MessageLoadOptions } from './MessageLoadOptions';
import type { ConversationDraftProjection } from './resources/ConversationDraftProjection';

import { PublicMutationSigner } from '../../../../shared/infrastructure/crypto/PublicMutationSigner';
import { submitPublicMutation } from '../../../../shared/infrastructure/http/submitPublicMutation';
import { DraftPayloadCipher } from '../crypto/DraftPayloadCipher';
import { PigeonLinkPreviewsApi } from './PigeonLinkPreviewsApi';

const readCacheTtlMs = 1500;

export class PigeonMessagesApi {
  private readonly draftPayloads: DraftPayloadCipher;

  private readonly linkPreviews: PigeonLinkPreviewsApi;

  private readonly mutations = new PublicMutationSigner();

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

  private async sendMutation(
    session: Session,
    method: 'DELETE' | 'POST',
    path: string,
    kind: 'delete' | 'put',
    store: 'pins' | 'reactions',
    payload: Record<string, unknown>,
    fields: Record<string, unknown> = {},
  ): Promise<void> {
    await submitPublicMutation(
      PublicMutationSigner.FIRST_POSITION,
      (position) =>
        this.mutations.sign(
          session,
          { kind, payload, recordId: String(payload.id), store },
          position,
        ),
      async (mutation) => {
        const body = { ...fields, mutation };

        await this.http.request(path, {
          body: JSON.stringify(body),
          headers: await this.signer.headers(session, method, path, body),
          method,
        });
      },
    );
  }

  private pinRecord(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Record<string, unknown> {
    return {
      conversationId,
      id: `conversation:${conversationId}:${messageId}`,
      messageId,
      pinnedByIdentityId: this.mutations.authorOf(session),
      scopeType: 'conversation',
    };
  }

  private reactionRecord(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Record<string, unknown> {
    const authorId = this.mutations.authorOf(session);

    return {
      authorId,
      conversationId,
      emoji,
      id: ['conversation', conversationId, messageId, authorId, emoji].join(
        ':',
      ),
      messageId,
      scopeType: 'conversation',
    };
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

    const createdAt = Date.now();

    await this.sendMutation(
      session,
      'POST',
      path,
      'put',
      'pins',
      { ...this.pinRecord(session, conversationId, messageId), createdAt },
      { createdAt },
    );
    this.invalidatePins(session, conversationId);
  }

  public async unpinMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    const path = `${this.messagePath(conversationId, messageId)}/pin`;

    await this.sendMutation(session, 'DELETE', path, 'delete', 'pins', {
      ...this.pinRecord(session, conversationId, messageId),
      removed: true,
    });
    this.invalidatePins(session, conversationId);
  }

  public async listConversationDrafts(
    session: Session,
  ): Promise<ConversationDraftProjection[]> {
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
  ): Promise<ConversationDraftProjection> {
    const path = `/conversations/${encodeURIComponent(conversationId)}/draft`;
    const encryptedPayload = this.draftPayloads.encrypt(session, content);
    const body = { encryptedPayload, updatedAt };
    const draft = await this.http.request<ConversationDraftResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'PUT', path, body),
      method: 'PUT',
    });
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
    const createdAt = Date.now();

    await this.sendMutation(
      session,
      'POST',
      `${this.messagePath(conversationId, messageId)}/reactions`,
      'put',
      'reactions',
      {
        ...this.reactionRecord(session, conversationId, messageId, emoji),
        createdAt,
      },
      { createdAt, emoji },
    );
  }

  public async removeMessageReaction(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.sendMutation(
      session,
      'DELETE',
      `${this.messagePath(conversationId, messageId)}/reactions`,
      'delete',
      'reactions',
      {
        ...this.reactionRecord(session, conversationId, messageId, emoji),
        removed: true,
      },
      { emoji },
    );
  }
}
