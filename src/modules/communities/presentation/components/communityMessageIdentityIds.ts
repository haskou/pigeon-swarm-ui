import type {
  ChatMessage,
  PollResource,
} from '../../../../shared/domain/pigeonResources.types';

export function communityMessageIdentityIds({
  messages = [],
  polls = [],
}: {
  messages?: readonly ChatMessage[];
  polls?: readonly PollResource[];
}): string[] {
  const identityIds = new Set<string>();

  for (const message of messages) {
    addIdentityId(identityIds, message.authorIdentityId);
    addIdentityId(identityIds, message.replyPreview?.authorIdentityId);

    for (const reaction of message.reactions) {
      addIdentityId(identityIds, reaction.authorIdentityId);
    }

    if (message.poll) {
      collectPollIdentityIds(identityIds, message.poll);
    }
  }

  for (const poll of polls) {
    collectPollIdentityIds(identityIds, poll);
  }

  return Array.from(identityIds);
}

function collectPollIdentityIds(
  identityIds: Set<string>,
  poll: PollResource,
): void {
  addIdentityId(identityIds, poll.creatorIdentityId);

  for (const vote of poll.votes) {
    addIdentityId(identityIds, vote.voterIdentityId);
  }
}

function addIdentityId(identityIds: Set<string>, identityId?: string): void {
  const normalized = identityId?.trim();

  if (normalized) identityIds.add(normalized);
}
