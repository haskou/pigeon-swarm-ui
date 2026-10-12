import type {
  ChatMessage,
  ConversationResource,
} from '../../../../shared/domain/pigeonResources.types';
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
