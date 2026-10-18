import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { Session } from '../../../identities/infrastructure/session/Session';
import type { ConversationMapper } from './ConversationMapper';
import type { ConversationResource } from './ConversationResource';
import type { ConversationsResource } from './ConversationsResource';

import { pagedPath } from '../../../../shared/infrastructure/http/pagedPath';
import { readAllPages } from '../../../../shared/infrastructure/http/readAllPages';

export class PigeonConversationsApi {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    private readonly mapper: ConversationMapper,
  ) {}

  public async list(session: Session): Promise<ConversationResource[]> {
    const path = '/conversations';
    const pages = await readAllPages<ConversationsResource>(async (cursor) => {
      const target = pagedPath(path, cursor);

      return await this.http.request<ConversationsResource>(target, {
        headers: await this.signer.headers(session, 'GET', target),
        method: 'GET',
      });
    });

    return pages.flatMap((page) => this.mapper.list(page));
  }
}
