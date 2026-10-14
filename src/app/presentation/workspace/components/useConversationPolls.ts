import { Timestamp } from '@haskou/value-objects';
import { useCallback, useMemo, useState } from 'react';

import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { DirectMessageTimelineChange } from '../../../../contexts/messages/domain/DirectMessageTimelineChange';
import type { PollSnapshot } from '../../../../contexts/polls/domain/PollSnapshot';
import type { ConversationPollsController } from './ConversationPollsController';

import { PollBoard } from '../../../../contexts/polls/domain/PollBoard';
import { applicationContainer } from '../../../composition/applicationContainer';

/**
 * The polls of the active group conversation, folded on one PollBoard per
 * conversation from the poll records its MLS mailboxes carry. Restore and
 * sync hand their poll changes to `fold`; this identity's own poll, vote
 * and close are folded as soon as they are queued.
 */
export function useConversationPolls({
  conversation,
  session,
}: {
  conversation?: ConversationResource;
  session: Session;
}): ConversationPollsController {
  const conversationId = conversation?.id;
  const board = useMemo(
    () => ({ conversationId, value: new PollBoard() }),
    [conversationId],
  );
  const [shown, setShown] = useState<{
    board: PollBoard;
    polls: PollSnapshot[];
  }>();
  const fold = useCallback(
    (changes: DirectMessageTimelineChange[]) => {
      const receivedAt = Timestamp.now();

      for (const change of changes) {
        switch (change.kind) {
          case 'poll':
            board.value.create({
              allowsMultipleVotes: change.allowsMultipleVotes,
              createdAt: change.createdAt,
              creatorIdentityId: change.creatorIdentityId,
              id: change.id,
              options: change.options,
              question: change.question,
            });
            break;
          case 'poll_vote':
            board.value.vote(
              {
                createdAt: change.createdAt,
                optionIds: change.optionIds,
                pollId: change.pollId,
                voterIdentityId: change.voterIdentityId,
              },
              receivedAt,
            );
            break;
          case 'poll_close':
            board.value.close(
              {
                closerIdentityId: change.closerIdentityId,
                createdAt: change.createdAt,
                pollId: change.pollId,
              },
              receivedAt,
            );
            break;
          default:
            break;
        }
      }

      setShown({ board: board.value, polls: board.value.polls() });
    },
    [board],
  );
  const active = useMemo(
    () => (shown?.board === board.value ? shown.polls : []),
    [board, shown],
  );

  const create = useCallback(
    async (input: {
      allowsMultipleVotes: boolean;
      options: { id: string; text: string }[];
      question: string;
    }) => {
      if (!conversation) return;

      fold([
        await applicationContainer.groupMessages.createPoll(
          session,
          conversation,
          input,
        ),
      ]);
    },
    [conversation, fold, session],
  );
  const vote = useCallback(
    async (poll: PollSnapshot, optionIds: string[]) => {
      if (!conversation) return;

      fold([
        await applicationContainer.groupMessages.votePoll(
          session,
          conversation,
          poll.id,
          optionIds,
        ),
      ]);
    },
    [conversation, fold, session],
  );
  const removeVote = useCallback(
    (poll: PollSnapshot) => vote(poll, []),
    [vote],
  );
  const close = useCallback(
    async (poll: PollSnapshot) => {
      if (!conversation) return;

      fold([
        await applicationContainer.groupMessages.closePoll(
          session,
          conversation,
          poll.id,
        ),
      ]);
    },
    [conversation, fold, session],
  );

  return { active, close, create, fold, removeVote, vote };
}
