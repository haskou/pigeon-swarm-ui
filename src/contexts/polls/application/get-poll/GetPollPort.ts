import type {
  PollResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface GetPollPort {
  getPoll(session: Session, pollId: string): Promise<PollResource>;
}
