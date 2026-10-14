import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestCache } from '../../../../shared/infrastructure/http/RequestCache';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { Session } from '../../../identities/infrastructure/session/Session';
import type { ConversationDraftResource } from './ConversationDraftResource';
import type { ConversationDraftsResource } from './ConversationDraftsResource';
import type { ConversationDraftProjection } from './resources/ConversationDraftProjection';

import { DraftPayloadCipher } from '../crypto/DraftPayloadCipher';

const readCacheTtlMs = 1500;

/** The encrypted conversation drafts the node keeps for this identity. */
export class PigeonConversationDraftsApi {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    private readonly requestCache: RequestCache,
    private readonly draftPayloads = new DraftPayloadCipher(),
  ) {}

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

        return result.drafts.flatMap((draft) => {
          const content = this.draftPayloads.decrypt(
            session,
            draft.encryptedPayload,
          );

          return content === null ? [] : [{ ...draft, content }];
        });
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
}
