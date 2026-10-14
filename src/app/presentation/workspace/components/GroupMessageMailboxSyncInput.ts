import type { Dispatch, SetStateAction } from 'react';

import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { ChatMessage } from '../../../../contexts/messages/presentation/view-models/ChatMessage';

export type GroupMessageMailboxSyncInput = {
  activeConversation: ConversationResource | undefined;
  onErrorChange: Dispatch<SetStateAction<string | null>>;
  onHistoryRestored: (conversationId: string) => void;
  onMessagesChange: Dispatch<SetStateAction<ChatMessage[]>>;
  refreshConversations: () => Promise<unknown>;
  session: Session;
  setPinnedMessageIds: Dispatch<SetStateAction<Set<string>>>;
};
