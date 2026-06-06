import type { PollResource } from '../../../../shared/domain/pigeonResources.types';
import type { VotePollMessage } from '../vote-poll/messages/VotePollMessage';

export interface VotePollPort {
  vote(message: VotePollMessage): Promise<PollResource>;
}
