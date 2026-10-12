import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type {
  ConversationKeyEntry,
  ConversationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

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
