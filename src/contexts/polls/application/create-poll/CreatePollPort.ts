import type {
  CreatePollInput,
  PollResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface CreatePollPort {
  createPoll(session: Session, input: CreatePollInput): Promise<PollResource>;
}
