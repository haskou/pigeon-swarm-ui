import type { ChatMessage } from '../../../../contexts/messages/presentation/view-models/ChatMessage';
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
