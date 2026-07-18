import type { Poll } from '../../domain/Poll';
import type { PollRepository } from '../../domain/repositories/PollRepository';

import { Poll as PollAggregate } from '../../domain/Poll';
import { CreatePollMessage } from './messages/CreatePollMessage';

export class PollCreator {
  public constructor(private readonly pollRepository: PollRepository) {}

  public async create(message: CreatePollMessage): Promise<Poll> {
    const actorId = message.getActorId();
    const poll = PollAggregate.create(
      message.getDefinition(),
      message.getOccurredAt(),
    );

    return await this.pollRepository.create(poll, actorId);
  }
}
