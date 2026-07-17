import type { CallIceServerResource } from '../../../contexts/calls/infrastructure/http/resources/CallIceServerResource';
import type { CallResource } from '../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { Session } from '../../../shared/domain/pigeonResources.types';

import { CallFinder } from '../../../contexts/calls/application/find-call/CallFinder';
import { FindCallMessage } from '../../../contexts/calls/application/find-call/messages/FindCallMessage';
import { CallsSearcher } from '../../../contexts/calls/application/search-calls/CallsSearcher';
import { SearchCallsMessage } from '../../../contexts/calls/application/search-calls/messages/SearchCallsMessage';
import { CallMapper } from '../../../contexts/calls/infrastructure/http/CallMapper';
import { PigeonCallsApi } from '../../../contexts/calls/infrastructure/http/PigeonCallsApi';
import { CallSessionRegistrar } from './CallSessionRegistrar';

export class PigeonCallReader {
  public constructor(
    private readonly sessions: CallSessionRegistrar,
    private readonly mapper: CallMapper,
    private readonly api: PigeonCallsApi,
    private readonly finder: CallFinder,
    private readonly searcher: CallsSearcher,
  ) {}

  public async find(session: Session, callId: string): Promise<CallResource> {
    const call = await this.finder.find(
      new FindCallMessage(callId, this.sessions.register(session)),
    );

    return this.mapper.toResource(call);
  }

  public async getIceServers(session: Session): Promise<CallIceServerResource> {
    this.sessions.register(session);

    return await this.api.getIceServers(session);
  }

  public async search(session: Session): Promise<CallResource[]> {
    const calls = await this.searcher.search(
      new SearchCallsMessage(this.sessions.register(session)),
    );

    return calls.map((call) => this.mapper.toResource(call));
  }
}
