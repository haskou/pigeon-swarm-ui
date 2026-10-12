import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { ConversationKeyEntry } from '../../../../contexts/identities/infrastructure/keychain/ConversationKeyEntry';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

export type UseConversationTimelineInput = {
  activeConversation?: ConversationResource;
  activeConversationKey?: ConversationKeyEntry;
  clearUnreadMessages: (conversationId: string) => void;
  onCommunitiesReload: () => Promise<void>;
  onConversationsChange: Dispatch<SetStateAction<ConversationResource[]>>;
  onErrorChange: (error: null | string) => void;
  refreshConversations: () => Promise<ConversationResource[]>;
  sessionRef: MutableRefObject<Session>;
  suppressMessageLoadsUntilRef: MutableRefObject<number>;
  workspaceMode: 'community' | 'messages';
};
