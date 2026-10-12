import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { ChatMessage } from '../../../../contexts/messages/presentation/view-models/ChatMessage';
import type { ConversationMessageLoadState } from './ConversationMessageLoadState';
import type { MessageViewport } from './MessageViewport';

export type ConversationTimelineController = {
  bottomRef: MessageViewport['bottomRef'];
  handleScroll: () => void;
  isScrolledNearBottom: () => boolean;
  jumpToLatestMessages: () => void;
  markConversationReadUntil: (
    conversationId: string,
    loadedMessages: ChatMessage[],
  ) => void;
  messageCursor: null | string;
  messageState: ConversationMessageLoadState;
  messages: ChatMessage[];
  messagesRef: MutableRefObject<ChatMessage[]>;
  newMessageCount: number;
  scrollerRef: MessageViewport['scrollerRef'];
  scrollMessagesToBottom: MessageViewport['scrollMessagesToBottom'];
  setMessageLoadState: (state: ConversationMessageLoadState) => void;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setNewMessageCount: Dispatch<SetStateAction<number>>;
  updateMessageCursor: (cursor: null | string) => void;
};
