import type { PollResource } from '../../../../shared/domain/pigeonResources.types';
import type { VotePollMessage } from '../vote-poll/messages/votePollMessage';

export interface VotePollPort {
  vote(message: VotePollMessage): Promise<PollResource>;
}
