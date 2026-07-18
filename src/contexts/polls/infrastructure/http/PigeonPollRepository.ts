import { assert, type PrimitiveOf } from '@haskou/value-objects';

import type { Poll } from '../../domain/Poll';
import type { PollRepository } from '../../domain/repositories/PollRepository';
import type { PollActorId } from '../../domain/value-objects/PollActorId';
import type { PollId } from '../../domain/value-objects/PollId';

import { PollVoteProjectionNotFoundError } from './errors/PollVoteProjectionNotFoundError';
import { PigeonPollsApi } from './PigeonPollsApi';
import { PollAccessContexts } from './PollAccessContexts';
import { PollMapper } from './PollMapper';

export class PigeonPollRepository implements PollRepository {
  public constructor(
    private readonly api: PigeonPollsApi,
    private readonly contexts: PollAccessContexts,
    private readonly mapper: PollMapper,
  ) {}

  public async close(poll: Poll, actorId: PollActorId): Promise<Poll> {
    const primitives: PrimitiveOf<Poll> = poll.toPrimitives();
    const resource = await this.api.close(
      this.contexts.find(actorId),
      primitives.id,
    );

    return this.mapper.fromResource(resource);
  }

  public async create(poll: Poll, actorId: PollActorId): Promise<Poll> {
    const resource = await this.api.create(
      this.contexts.find(actorId),
      this.mapper.toCreateRequest(poll),
    );

    return this.mapper.fromResource(resource);
  }

  public async find(id: PollId, actorId: PollActorId): Promise<Poll> {
    return this.mapper.fromResource(
      await this.api.get(this.contexts.find(actorId), id.toString()),
    );
  }

  public async removeVote(poll: Poll, actorId: PollActorId): Promise<Poll> {
    const primitives: PrimitiveOf<Poll> = poll.toPrimitives();
    const resource = await this.api.removeVote(
      this.contexts.find(actorId),
      primitives.id,
    );

    return this.mapper.fromResource(resource);
  }

  public async vote(poll: Poll, actorId: PollActorId): Promise<Poll> {
    const primitives: PrimitiveOf<Poll> = poll.toPrimitives();
    const vote = primitives.votes.find(
      (candidate) => candidate.voterIdentityId === actorId.toString(),
    );

    assert(vote, new PollVoteProjectionNotFoundError());

    return this.mapper.fromResource(
      await this.api.vote(
        this.contexts.find(actorId),
        primitives.id,
        vote.optionIds,
      ),
    );
  }
}
