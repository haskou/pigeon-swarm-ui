import type {
  CreatePollInput,
  PollResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { PigeonPollsApi } from './PigeonPollsApi';

export class PigeonPollsGateway {
  public constructor(private readonly polls: PigeonPollsApi) {}

  public async closePoll(
    session: Session,
    pollId: string,
  ): Promise<PollResource> {
    return await this.polls.close(session, pollId);
  }

  public async createPoll(
    session: Session,
    input: CreatePollInput,
  ): Promise<PollResource> {
    return await this.polls.create(session, input);
  }

  public async getPoll(
    session: Session,
    pollId: string,
  ): Promise<PollResource> {
    return await this.polls.get(session, pollId);
  }

  public async removePollVote(
    session: Session,
    pollId: string,
  ): Promise<PollResource> {
    return await this.polls.removeVote(session, pollId);
  }

  public async votePoll(
    session: Session,
    pollId: string,
    optionIds: string[],
  ): Promise<PollResource> {
    return await this.polls.vote(session, pollId, optionIds);
  }
}
