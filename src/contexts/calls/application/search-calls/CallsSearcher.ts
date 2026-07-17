import type { Call } from '../../domain/Call';
import type { CallRepository } from '../../domain/repositories/CallRepository';

import { SearchCallsMessage } from './messages/SearchCallsMessage';

export class CallsSearcher {
  public constructor(private readonly callRepository: CallRepository) {}

  public async search(message: SearchCallsMessage): Promise<Call[]> {
    return await this.callRepository.search(message.getActorIdentityId());
  }
}
