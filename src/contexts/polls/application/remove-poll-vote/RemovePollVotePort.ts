import type {
  PollResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface RemovePollVotePort {
  removePollVote(session: Session, pollId: string): Promise<PollResource>;
}
