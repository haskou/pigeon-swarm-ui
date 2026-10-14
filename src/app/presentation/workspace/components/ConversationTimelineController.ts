import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { ChatMessage } from '../../../../contexts/messages/domain/ChatMessage';
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
  messageState: ConversationMessageLoadState;
  messages: ChatMessage[];
  messagesRef: MutableRefObject<ChatMessage[]>;
  newMessageCount: number;
  scrollerRef: MessageViewport['scrollerRef'];
  scrollMessagesToBottom: MessageViewport['scrollMessagesToBottom'];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setNewMessageCount: Dispatch<SetStateAction<number>>;
};
