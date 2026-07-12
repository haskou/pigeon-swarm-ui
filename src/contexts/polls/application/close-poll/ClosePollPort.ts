import type {
  PollResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface ClosePollPort {
  closePoll(session: Session, pollId: string): Promise<PollResource>;
}
