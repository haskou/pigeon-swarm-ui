import type {
  ChatMessage,
  MessageResource,
  PollResource,
} from '../../../shared/domain/pigeonResources.types';

export class PollMessageProjection {
  public static fromMessageResource(
    message: MessageResource,
  ): PollResource | null {
    if (message.poll) return message.poll;

    const {
      allowsMultipleVotes,
      createdAt,
      creatorIdentityId,
      expiresAt,
      id,
      options,
      question,
      scope,
      status,
      timestamp,
      type,
      votes,
    } = message;
    const requiredFields = [
      id,
      creatorIdentityId,
      question,
      options,
      scope,
      status,
      votes,
    ];

    if (type !== 'poll' || requiredFields.some((field) => !field)) {
      return null;
    }

    return {
      allowsMultipleVotes: Boolean(allowsMultipleVotes),
      createdAt: createdAt ?? timestamp ?? Date.now(),
      creatorIdentityId: creatorIdentityId!,
      expiresAt,
      id: id!,
      options: options!,
      question: question!,
      scope: scope!,
      status: status!,
      votes: votes!,
    };
  }

  public static isMessageResource(message: MessageResource): boolean {
    return message.type === 'poll' || Boolean(message.poll);
  }

  public static toChatMessage(
    message: MessageResource,
    currentIdentityId: string,
  ): ChatMessage | null {
    const poll = PollMessageProjection.fromMessageResource(message);

    if (!poll) return null;

    return {
      attachments: [],
      authorIdentityId: poll.creatorIdentityId,
      content: '',
      encrypted: false,
      id: poll.id,
      kind: 'poll',
      mine: poll.creatorIdentityId === currentIdentityId,
      poll,
      raw: message,
      reactions: [],
      timestamp: poll.createdAt,
    };
  }
}
