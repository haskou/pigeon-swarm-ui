import type {
  CreatePollInput,
  PollResource,
  Session,
} from '../../../shared/domain/pigeonResources.types';
import type { ClosePollPort } from './close-poll/ClosePollPort';
import type { CreatePollPort } from './create-poll/CreatePollPort';
import type { GetPollPort } from './get-poll/GetPollPort';
import type { RemovePollVotePort } from './remove-poll-vote/RemovePollVotePort';
import type { VotePollPort } from './vote-poll/VotePollPort';

import { VotePollMessage } from './vote-poll/messages/VotePollMessage';
import { VotePoll } from './vote-poll/VotePoll';

export class PigeonPollsApplication {
  private readonly votePoll: VotePoll;

  public constructor(
    private readonly dependencies: {
      closePoll: ClosePollPort;
      createPoll: CreatePollPort;
      getPoll: GetPollPort;
      removePollVote: RemovePollVotePort;
      votePoll: VotePollPort;
    },
  ) {
    this.votePoll = new VotePoll({
      vote: async (message) => await dependencies.votePoll.vote(message),
    });
  }

  public async close(session: Session, pollId: string): Promise<PollResource> {
    return await this.dependencies.closePoll.closePoll(session, pollId);
  }

  public async create(
    session: Session,
    input: CreatePollInput,
  ): Promise<PollResource> {
    return await this.dependencies.createPoll.createPoll(session, input);
  }

  public async get(session: Session, pollId: string): Promise<PollResource> {
    return await this.dependencies.getPoll.getPoll(session, pollId);
  }

  public async removeVote(
    session: Session,
    pollId: string,
  ): Promise<PollResource> {
    return await this.dependencies.removePollVote.removePollVote(
      session,
      pollId,
    );
  }

  public async vote(
    session: Session,
    pollId: string,
    optionIds: string[],
  ): Promise<PollResource> {
    return await this.votePoll.vote(
      new VotePollMessage({ optionIds, pollId, session }),
    );
  }
}
