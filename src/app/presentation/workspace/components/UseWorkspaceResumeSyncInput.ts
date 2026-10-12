import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { ChatMessage } from '../../../../contexts/messages/presentation/view-models/ChatMessage';
import type { WorkspaceMode } from './WorkspaceMode';

export type UseWorkspaceResumeSyncInput = {
  activeConversationId?: string | null;
  activeConversationKeyId?: string | null;
  loadActiveMessages: (conversationId: string) => Promise<void>;
  loadedMessages: { current: ChatMessage[] };
  onCommunitiesReload: () => Promise<void>;
  refreshConversations: () => Promise<ConversationResource[]>;
  workspaceMode: WorkspaceMode;
};
