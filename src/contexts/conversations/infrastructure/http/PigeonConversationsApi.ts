import type {
  ConversationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestCache } from '../../../../shared/infrastructure/http/RequestCache';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { ConversationMapper } from './ConversationMapper';

const conversationsCacheTtlMs = 1500;

export class PigeonConversationsApi {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    private readonly mapper: ConversationMapper,
    private readonly requestCache: RequestCache,
  ) {}

  public async list(session: Session): Promise<ConversationResource[]> {
    const path = '/conversations/?limit=30';
    const raw = await this.requestCache.load(
      this.requestCache.keyForSession(path, session),
      async () =>
        await this.http.request<unknown>(path, {
          headers: await this.signer.headers(session, 'GET', path),
          method: 'GET',
        }),
      { ttlMs: conversationsCacheTtlMs },
    );

    return this.mapper.list(raw);
  }

  public async markReadUntil(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    const path = `/conversations/${encodeURIComponent(
      conversationId,
    )}/messages/read-until`;
    const body = { messageId };

    await this.http.request(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'PUT', path, body),
      method: 'PUT',
    });
  }
}
