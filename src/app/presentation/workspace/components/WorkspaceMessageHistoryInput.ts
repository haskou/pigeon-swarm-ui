import type {
  Dispatch,
  MutableRefObject,
  RefObject,
  SetStateAction,
} from 'react';

import type { MessageScrollAnchorSnapshot } from '../../../../contexts/messages/presentation/view-models/MessageScrollAnchor';
import type {
  ChatMessage,
  ConversationKeyEntry,
  ConversationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { LoadState } from './LoadState';
import type { WorkspaceMode } from './WorkspaceMode';

export type WorkspaceMessageHistoryInput = {
  activeConversation?: ConversationResource;
  activeConversationKey?: ConversationKeyEntry;
  isScrolledNearBottom: () => boolean;
  keepMessageBottomUntilRef: MutableRefObject<number>;
  lastScrollTopRef: MutableRefObject<number>;
  messageCursorRef: MutableRefObject<string | null>;
  messageRequestRef: MutableRefObject<number>;
  messageScrollAnchorRef: MutableRefObject<MessageScrollAnchorSnapshot | null>;
  messageStateRef: MutableRefObject<LoadState>;
  messagesRef: MutableRefObject<ChatMessage[]>;
  scrollerRef: RefObject<HTMLDivElement | null>;
  sessionRef: MutableRefObject<Session>;
  setMessageLoadState: (state: LoadState) => void;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setNewMessageCount: Dispatch<SetStateAction<number>>;
  setSendError: (error: string | null) => void;
  suppressMessageLoadsUntilRef: MutableRefObject<number>;
  updateMessageCursor: (cursor: null | string) => void;
  workspaceMode: WorkspaceMode;
};
