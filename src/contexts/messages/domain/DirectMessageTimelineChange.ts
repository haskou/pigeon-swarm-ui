import type { ChatMessage } from './ChatMessage';

/** One change to the timeline, in the order the inbox holds it. */
export type DirectMessageTimelineChange =
  | { kind: 'edit'; message: ChatMessage }
  | { kind: 'message'; message: ChatMessage }
  | {
      action: 'add' | 'remove';
      authorId: string;
      createdAt: number;
      emoji: string;
      kind: 'reaction';
      messageId: string;
    }
  | {
      action: 'pin' | 'unpin';
      createdAt: number;
      kind: 'pin';
      messageId: string;
    }
  | {
      allowsMultipleVotes: boolean;
      createdAt: number;
      creatorIdentityId: string;
      id: string;
      kind: 'poll';
      options: { id: string; text: string }[];
      question: string;
    }
  | {
      createdAt: number;
      kind: 'poll_vote';
      optionIds: string[];
      pollId: string;
      voterIdentityId: string;
    }
  | {
      closerIdentityId: string;
      createdAt: number;
      kind: 'poll_close';
      pollId: string;
    }
  | { kind: 'read'; messageId: string }
  | { kind: 'removed'; messageId: string }
  | { createdAt: number; identityId: string; kind: 'typing' };
