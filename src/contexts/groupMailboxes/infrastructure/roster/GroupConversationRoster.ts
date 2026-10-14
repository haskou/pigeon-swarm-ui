import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { ConversationMapper } from '../../../conversations/infrastructure/http/ConversationMapper';
import type { Session } from '../../../identities/infrastructure/session/Session';

/**
 * The node's roster of one group conversation, as this identity sees it: the
 * conversations it belongs to are paged until the one asked for is found.
 * A conversation this identity is not in has an empty roster, so a removed
 * member honours no control letter and accepts no commit for it. Past
 * MAX_PAGES pages the roster is empty too; that is logged.
 */
export class GroupConversationRoster {
  private static readonly MAX_PAGES = 20;
  private static readonly PAGE_SIZE = 50;

  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    private readonly mapper: Pick<ConversationMapper, 'list'>,
  ) {}

  private async page(session: Session, before: string | undefined) {
    const query = new URLSearchParams({
      limit: String(GroupConversationRoster.PAGE_SIZE),
      ...(before ? { beforeConversationId: before } : {}),
    });
    const path = `/conversations/?${query.toString()}`;

    return this.mapper.list(
      await this.http.request<unknown>(path, {
        headers: await this.signer.headers(session, 'GET', path),
        method: 'GET',
      }),
    );
  }

  public async of(
    session: Session,
    conversationId: string,
  ): Promise<ReadonlySet<string>> {
    let before: string | undefined;

    for (let page = 0; page < GroupConversationRoster.MAX_PAGES; page += 1) {
      const conversations = await this.page(session, before);
      const found = conversations.find(({ id }) => id === conversationId);

      if (found?.type === 'group') return new Set(found.participantIds);

      if (found || conversations.length < GroupConversationRoster.PAGE_SIZE) {
        return new Set();
      }
      before = conversations[conversations.length - 1].id;
    }

    // eslint-disable-next-line no-console
    console.debug('Group roster paging cap reached.');

    return new Set();
  }
}
