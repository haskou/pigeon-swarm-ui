import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  ConversationResource,
  PollResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/RealtimeGateway';

import { applicationContainer } from '../../../composition/applicationContainer';

export interface ConversationPollsController {
  active: PollResource[];
  close: (poll: PollResource) => Promise<void>;
  create: (input: {
    allowsMultipleVotes: boolean;
    options: { id: string; text: string }[];
    question: string;
  }) => Promise<void>;
  removeVote: (poll: PollResource) => Promise<void>;
  vote: (poll: PollResource, optionIds: string[]) => Promise<void>;
}

function withPoll(current: PollResource[], poll: PollResource): PollResource[] {
  return [...current.filter((item) => item.id !== poll.id), poll].sort(
    (left, right) => left.createdAt - right.createdAt,
  );
}

export function useConversationPolls({
  conversation,
  realtimeEvent,
  session,
}: {
  conversation?: ConversationResource;
  realtimeEvent?: RealtimeDomainEvent | null;
  session: Session;
}): ConversationPollsController {
  const [polls, setPolls] = useState<PollResource[]>([]);
  const upsert = useCallback((poll: PollResource) => {
    setPolls((current) => withPoll(current, poll));
  }, []);

  useEffect(() => {
    if (!realtimeEvent?.type.startsWith('polls.v1.')) return;

    const poll = realtimeEvent.attributes.poll as PollResource | undefined;
    const pollId =
      typeof realtimeEvent.attributes.pollId === 'string'
        ? realtimeEvent.attributes.pollId
        : undefined;

    if (poll?.scope.type === 'group_conversation') {
      upsert(poll);

      return;
    }

    if (!pollId) return;

    void applicationContainer.polls
      .get(session, pollId)
      .then((loadedPoll) => {
        if (loadedPoll.scope.type === 'group_conversation') upsert(loadedPoll);
      })
      .catch(() => undefined);
  }, [realtimeEvent, session, upsert]);

  const active = useMemo(
    () =>
      conversation
        ? polls.filter(
            (poll) =>
              poll.scope.type === 'group_conversation' &&
              poll.scope.conversationId === conversation.id,
          )
        : [],
    [conversation, polls],
  );

  const create = useCallback(
    async (input: {
      allowsMultipleVotes: boolean;
      options: { id: string; text: string }[];
      question: string;
    }) => {
      if (!conversation) return;

      upsert(
        await applicationContainer.polls.create(session, {
          allowsMultipleVotes: input.allowsMultipleVotes,
          conversationId: conversation.id,
          options: input.options,
          question: input.question,
          scopeType: 'group_conversation',
        }),
      );
    },
    [conversation, session, upsert],
  );

  const vote = useCallback(
    async (poll: PollResource, optionIds: string[]) => {
      upsert(
        await applicationContainer.polls.vote(session, poll.id, optionIds),
      );
    },
    [session, upsert],
  );
  const removeVote = useCallback(
    async (poll: PollResource) => {
      upsert(await applicationContainer.polls.removeVote(session, poll.id));
    },
    [session, upsert],
  );
  const close = useCallback(
    async (poll: PollResource) => {
      upsert(await applicationContainer.polls.close(session, poll.id));
    },
    [session, upsert],
  );

  return { active, close, create, removeVote, vote };
}
