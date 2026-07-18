import type {
  CreatePollInput,
  PollResource,
  Session,
} from '../../../shared/domain/pigeonResources.types';
import type { PollUseCases } from './PollUseCases';

import { ClosePollMessage } from '../../../contexts/polls/application/close-poll/messages/ClosePollMessage';
import { CreatePollMessage } from '../../../contexts/polls/application/create-poll/messages/CreatePollMessage';
import { FindPollMessage } from '../../../contexts/polls/application/find-poll/messages/FindPollMessage';
import { RemovePollVoteMessage } from '../../../contexts/polls/application/remove-poll-vote/messages/RemovePollVoteMessage';
import { VotePollMessage } from '../../../contexts/polls/application/vote-poll/messages/VotePollMessage';
import { PollAccessContexts } from '../../../contexts/polls/infrastructure/http/PollAccessContexts';
import { PollMapper } from '../../../contexts/polls/infrastructure/http/PollMapper';

export class PigeonPollsFacade {
  public constructor(
    private readonly contexts: PollAccessContexts,
    private readonly mapper: PollMapper,
    private readonly useCases: PollUseCases,
  ) {}

  private actor(session: Session): string {
    this.contexts.register(session);

    return session.identity.id;
  }

  public async close(session: Session, pollId: string): Promise<PollResource> {
    return this.mapper.toResource(
      await this.useCases.closer.close(
        new ClosePollMessage(this.actor(session), pollId, Date.now()),
      ),
    );
  }

  public async create(
    session: Session,
    input: CreatePollInput,
  ): Promise<PollResource> {
    const communityChannel = input.scopeType === 'community_channel';
    const firstIdentifier = communityChannel
      ? input.communityId
      : input.conversationId;
    const secondIdentifier = communityChannel ? input.channelId : undefined;

    return this.mapper.toResource(
      await this.useCases.creator.create(
        new CreatePollMessage({
          actorIdentityId: this.actor(session),
          allowsMultipleVotes: input.allowsMultipleVotes,
          expiresAt: input.expiresAt,
          firstScopeIdentifier: firstIdentifier,
          occurredAt: Date.now(),
          options: input.options,
          question: input.question,
          scopeType: input.scopeType,
          secondScopeIdentifier: secondIdentifier,
        }),
      ),
    );
  }

  public async get(session: Session, pollId: string): Promise<PollResource> {
    return this.mapper.toResource(
      await this.useCases.finder.find(
        new FindPollMessage(this.actor(session), pollId),
      ),
    );
  }

  public async removeVote(
    session: Session,
    pollId: string,
  ): Promise<PollResource> {
    return this.mapper.toResource(
      await this.useCases.voteRemover.remove(
        new RemovePollVoteMessage(this.actor(session), pollId, Date.now()),
      ),
    );
  }

  public async vote(
    session: Session,
    pollId: string,
    optionIds: string[],
  ): Promise<PollResource> {
    return this.mapper.toResource(
      await this.useCases.voter.vote(
        new VotePollMessage(this.actor(session), pollId, optionIds, Date.now()),
      ),
    );
  }
}
