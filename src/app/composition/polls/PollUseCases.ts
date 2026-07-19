import type { PollCloser } from '../../../contexts/polls/application/close-poll/PollCloser';
import type { PollCreator } from '../../../contexts/polls/application/create-poll/PollCreator';
import type { PollFinder } from '../../../contexts/polls/application/find-poll/PollFinder';
import type { PollVoteRemover } from '../../../contexts/polls/application/remove-poll-vote/PollVoteRemover';
import type { PollVoter } from '../../../contexts/polls/application/vote-poll/PollVoter';

export type PollUseCases = {
  closer: PollCloser;
  creator: PollCreator;
  finder: PollFinder;
  voteRemover: PollVoteRemover;
  voter: PollVoter;
};
