import type {
  CreatePollInput,
  PollResource,
  Session,
} from '../../shared/domain/pigeonResources.types';

import { VotePollMessage } from '../../contexts/polls/application/vote-poll/messages/VotePollMessage';
import { VotePoll } from '../../contexts/polls/application/vote-poll/VotePoll';
import { PigeonApiGateway } from './PigeonApiGateway';

export class PigeonPollsApplication {
  private readonly votePoll: VotePoll;

  public constructor(private readonly gateway: PigeonApiGateway) {
    this.votePoll = new VotePoll({
      vote: async (message) =>
        await gateway.votePoll(
          message.getSession(),
          message.getPollId().toString(),
          message.getOptionIds().map((optionId) => optionId.toString()),
        ),
    });
  }

  public async close(session: Session, pollId: string): Promise<PollResource> {
    return await this.gateway.closePoll(session, pollId);
  }

  public async create(
    session: Session,
    input: CreatePollInput,
  ): Promise<PollResource> {
    return await this.gateway.createPoll(session, input);
  }

  public async get(session: Session, pollId: string): Promise<PollResource> {
    return await this.gateway.getPoll(session, pollId);
  }

  public async removeVote(
    session: Session,
    pollId: string,
  ): Promise<PollResource> {
    return await this.gateway.removePollVote(session, pollId);
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
