import type { ChatMessage } from '../../../../contexts/messages/domain/ChatMessage';
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
