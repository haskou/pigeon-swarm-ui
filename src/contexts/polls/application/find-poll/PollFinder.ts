import type { Poll } from '../../domain/Poll';
import type { PollRepository } from '../../domain/repositories/PollRepository';

import { FindPollMessage } from './messages/FindPollMessage';

export class PollFinder {
  public constructor(private readonly pollRepository: PollRepository) {}

  public async find(message: FindPollMessage): Promise<Poll> {
    return await this.pollRepository.find(
      message.getPollId(),
      message.getActorId(),
    );
  }
}
