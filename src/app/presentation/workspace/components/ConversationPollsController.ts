import type { DirectMessageTimelineChange } from '../../../../contexts/messages/domain/DirectMessageTimelineChange';
import type { PollSnapshot } from '../../../../contexts/polls/domain/PollSnapshot';

/**
 * The polls of the active group conversation and what this identity does
 * with them.
 */
export interface ConversationPollsController {
  active: PollSnapshot[];
  close: (poll: PollSnapshot) => Promise<void>;
  create: (input: {
    allowsMultipleVotes: boolean;
    options: { id: string; text: string }[];
    question: string;
  }) => Promise<void>;
  /** Folds poll changes read from the conversation's mailboxes. */
  fold: (changes: DirectMessageTimelineChange[]) => void;
  removeVote: (poll: PollSnapshot) => Promise<void>;
  vote: (poll: PollSnapshot, optionIds: string[]) => Promise<void>;
}
