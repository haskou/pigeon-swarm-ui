import type { Dispatch, SetStateAction } from 'react';

import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { ChatMessage } from '../../../../contexts/messages/domain/ChatMessage';
import type { DirectMessageTimelineChange } from '../../../../contexts/messages/domain/DirectMessageTimelineChange';

export type GroupMessageMailboxSyncInput = {
  activeConversation: ConversationResource | undefined;
  onErrorChange: Dispatch<SetStateAction<string | null>>;
  onHistoryRestored: (conversationId: string) => void;
  /** Receives each member that announced an identity update. */
  onIdentityUpdated: (identityId: string) => void;
  onMessagesChange: Dispatch<SetStateAction<ChatMessage[]>>;
  /** Receives the poll changes of each restore and pass, when any. */
  onPollChanges: (changes: DirectMessageTimelineChange[]) => void;
  /**
   * Receives the typing changes of each restore and pass, with the message
   * changes that end them, when any.
   */
  onTypingChanges: (
    conversationId: string,
    changes: DirectMessageTimelineChange[],
  ) => void;
  refreshConversations: () => Promise<unknown>;
  session: Session;
  setPinnedMessageIds: Dispatch<SetStateAction<Set<string>>>;
};
