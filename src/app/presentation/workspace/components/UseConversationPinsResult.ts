import type { ChatMessage } from '../../../../contexts/messages/presentation/view-models/ChatMessage';
import type { MessageCollectionState } from './conversationThreadState';

export type UseConversationPinsResult = {
  close: () => void;
  collection: MessageCollectionState | null;
  open: () => Promise<void>;
  pin: (message: ChatMessage) => Promise<void>;
  pinnedMessageIds: Set<string>;
  setCollection: React.Dispatch<
    React.SetStateAction<MessageCollectionState | null>
  >;
  setPinnedMessageIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  unpin: (message: ChatMessage) => Promise<void>;
  unpinFromCollection: (message: ChatMessage) => Promise<void>;
};
