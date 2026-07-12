import { useCallback } from 'react';

import type {
  PollResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';

type CreateCommunityPollInput = {
  allowsMultipleVotes: boolean;
  options: { id: string; text: string }[];
  question: string;
};

type CommunityPollWorkflowInput = {
  communityId: string;
  scrollToBottom: (behavior?: ScrollBehavior, force?: boolean) => void;
  selectedChannelId: null | string;
  session: Session;
  upsertPoll: (poll: PollResource) => void;
};

export function useCommunityPollWorkflow({
  communityId,
  scrollToBottom,
  selectedChannelId,
  session,
  upsertPoll,
}: CommunityPollWorkflowInput): {
  closePoll: (poll: PollResource) => Promise<void>;
  handleCreatePoll: (input: CreateCommunityPollInput) => Promise<void>;
  removePollVote: (poll: PollResource) => Promise<void>;
  votePoll: (poll: PollResource, optionIds: string[]) => Promise<void>;
} {
  const handleCreatePoll = useCallback(
    async (input: CreateCommunityPollInput) => {
      if (!selectedChannelId) return;

      const poll = await applicationContainer.polls.create(session, {
        allowsMultipleVotes: input.allowsMultipleVotes,
        channelId: selectedChannelId,
        communityId,
        options: input.options,
        question: input.question,
        scopeType: 'community_channel',
      });

      upsertPoll(poll);
      scrollToBottom('smooth', true);
    },
    [communityId, scrollToBottom, selectedChannelId, session, upsertPoll],
  );

  const votePoll = useCallback(
    async (poll: PollResource, optionIds: string[]) => {
      upsertPoll(
        await applicationContainer.polls.vote(session, poll.id, optionIds),
      );
    },
    [session, upsertPoll],
  );

  const removePollVote = useCallback(
    async (poll: PollResource) => {
      upsertPoll(
        await applicationContainer.polls.removeVote(session, poll.id),
      );
    },
    [session, upsertPoll],
  );

  const closePoll = useCallback(
    async (poll: PollResource) => {
      upsertPoll(await applicationContainer.polls.close(session, poll.id));
    },
    [session, upsertPoll],
  );

  return { closePoll, handleCreatePoll, removePollVote, votePoll };
}
