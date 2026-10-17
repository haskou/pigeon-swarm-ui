import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { Session } from '../../../identities/infrastructure/session/Session';
import type { ConversationMapper } from './ConversationMapper';
import type { ConversationResource } from './ConversationResource';

export class PigeonConversationsApi {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    private readonly mapper: ConversationMapper,
  ) {}

  public async list(session: Session): Promise<ConversationResource[]> {
    const path = '/conversations?limit=30';
    const raw = await this.http.request<unknown>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });

    return this.mapper.list(raw);
  }
}
