import {
  ConversationDraft,
  type ConversationDraftContent,
} from '@haskou/pigeon-swarm-crypto';

import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestCache } from '../../../../shared/infrastructure/http/RequestCache';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { Session } from '../../../identities/infrastructure/session/Session';
import type { ConversationDraftsResource } from './ConversationDraftsResource';
import type { ConversationDraftProjection } from './resources/ConversationDraftProjection';

import { sessionRootKey } from '../../../identities/infrastructure/session/sessionRootKey';

const readCacheTtlMs = 1500;
const draftsPath = '/conversation-drafts';

/**
 * The encrypted conversation drafts the node keeps for this identity, under
 * opaque `ConversationDraft` keys that never name the conversation.
 */
export class PigeonConversationDraftsApi {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    private readonly requestCache: RequestCache,
  ) {}

  /** Undefined for a draft that does not open under the key it is stored as. */
  private opened(
    session: Session,
    draftKey: string,
    encryptedPayload: string,
  ): ConversationDraftContent | undefined {
    try {
      return ConversationDraft.open(
        sessionRootKey(session),
        draftKey,
        encryptedPayload,
      );
    } catch {
      return undefined;
    }
  }

  private draftPath(session: Session, conversationId: string): string {
    return `${draftsPath}/${ConversationDraft.draftKey(sessionRootKey(session), conversationId)}`;
  }

  public async listConversationDrafts(
    session: Session,
  ): Promise<ConversationDraftProjection[]> {
    return await this.requestCache.load(
      this.requestCache.keyForSession(draftsPath, session),
      async () => {
        const result = await this.http.request<ConversationDraftsResource>(
          draftsPath,
          {
            headers: await this.signer.headers(session, 'GET', draftsPath),
            method: 'GET',
          },
        );

        return result.drafts.flatMap((draft) => {
          const opened = this.opened(
            session,
            draft.draftKey,
            draft.encryptedPayload,
          );

          return opened === undefined
            ? []
            : [
                {
                  content: opened.content,
                  conversationId: opened.conversationId,
                  encryptedPayload: draft.encryptedPayload,
                  updatedAt: draft.updatedAt,
                },
              ];
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
    const path = this.draftPath(session, conversationId);
    const encryptedPayload = ConversationDraft.seal(
      sessionRootKey(session),
      conversationId,
      content,
    );
    const body = { encryptedPayload, updatedAt };
    await this.http.request(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'PUT', path, body),
      method: 'PUT',
    });
    this.requestCache.invalidateForSession(draftsPath, session);

    return { content, conversationId, encryptedPayload, updatedAt };
  }

  public async deleteConversationDraft(
    session: Session,
    conversationId: string,
  ): Promise<void> {
    const path = this.draftPath(session, conversationId);

    await this.http.request(path, {
      headers: await this.signer.headers(session, 'DELETE', path),
      method: 'DELETE',
    });
    this.requestCache.invalidateForSession(draftsPath, session);
  }
}
