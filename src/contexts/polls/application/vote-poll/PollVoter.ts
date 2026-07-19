import type { Poll } from '../../domain/Poll';
import type { PollRepository } from '../../domain/repositories/PollRepository';

import { VotePollMessage } from './messages/VotePollMessage';

export class PollVoter {
  public constructor(private readonly pollRepository: PollRepository) {}

  public async vote(message: VotePollMessage): Promise<Poll> {
    const actorId = message.getActorId();
    const poll = await this.pollRepository.find(message.getPollId(), actorId);

    poll.vote(
      message.getVoterId(),
      message.getOptionIds(),
      message.getOccurredAt(),
    );

    return await this.pollRepository.vote(poll, actorId);
  }
}
