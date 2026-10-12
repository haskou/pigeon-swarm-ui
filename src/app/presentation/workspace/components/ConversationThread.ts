import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';
import type {
  EditingMessage,
  MessageCollectionState,
} from './conversationThreadState';

export type ConversationThread = MessageCollectionState & {
  draft: string;
  editingMessage: EditingMessage | null;
  replyTarget: ChatMessage | null;
  root: ChatMessage;
};
