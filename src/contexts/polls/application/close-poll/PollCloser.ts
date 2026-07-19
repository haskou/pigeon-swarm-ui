import type { Poll } from '../../domain/Poll';
import type { PollRepository } from '../../domain/repositories/PollRepository';

import { ClosePollMessage } from './messages/ClosePollMessage';

export class PollCloser {
  public constructor(private readonly pollRepository: PollRepository) {}

  public async close(message: ClosePollMessage): Promise<Poll> {
    const actorId = message.getActorId();
    const poll = await this.pollRepository.find(message.getPollId(), actorId);

    poll.close(message.getOccurredAt());

    return await this.pollRepository.close(poll, actorId);
  }
}
