import type { Dispatch, SetStateAction } from 'react';

import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { ChatMessage } from '../../../../contexts/messages/domain/ChatMessage';
import type { DirectMessageTimelineChange } from '../../../../contexts/messages/domain/DirectMessageTimelineChange';

export type GroupMessageMailboxSyncInput = {
  activeConversation: ConversationResource | undefined;
  onErrorChange: Dispatch<SetStateAction<string | null>>;
  onHistoryRestored: (conversationId: string) => void;
  onMessagesChange: Dispatch<SetStateAction<ChatMessage[]>>;
  /** Receives the poll changes of each restore and pass, when any. */
  onPollChanges: (changes: DirectMessageTimelineChange[]) => void;
  refreshConversations: () => Promise<unknown>;
  session: Session;
  setPinnedMessageIds: Dispatch<SetStateAction<Set<string>>>;
};
