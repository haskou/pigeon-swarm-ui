import type { Poll } from '../../domain/Poll';
import type { PollRepository } from '../../domain/repositories/PollRepository';

import { RemovePollVoteMessage } from './messages/RemovePollVoteMessage';

export class PollVoteRemover {
  public constructor(private readonly pollRepository: PollRepository) {}

  public async remove(message: RemovePollVoteMessage): Promise<Poll> {
    const actorId = message.getActorId();
    const poll = await this.pollRepository.find(message.getPollId(), actorId);

    poll.removeVote(message.getVoterId(), message.getOccurredAt());

    return await this.pollRepository.removeVote(poll, actorId);
  }
}
