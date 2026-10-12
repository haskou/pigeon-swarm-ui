import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';

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
  | { kind: 'read'; messageId: string }
  | { kind: 'removed'; messageId: string };
