import type {
  CreatePollInput,
  PollResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface PollApplicationPort {
  createPoll(session: Session, input: CreatePollInput): Promise<PollResource>;
  getPoll(session: Session, pollId: string): Promise<PollResource>;
  votePoll(
    session: Session,
    pollId: string,
    optionIds: string[],
  ): Promise<PollResource>;
  removePollVote(session: Session, pollId: string): Promise<PollResource>;
  closePoll(session: Session, pollId: string): Promise<PollResource>;
}
