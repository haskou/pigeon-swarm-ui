import type { PollResource } from '../../../../shared/domain/pigeonResources.types';
import type { VotePollPort } from './VotePollPort';

import { VotePollMessage } from './messages/VotePollMessage';

export class VotePoll {
  public constructor(private readonly polls: VotePollPort) {}

  public async vote(message: VotePollMessage): Promise<PollResource> {
    return await this.polls.vote(message);
  }
}
