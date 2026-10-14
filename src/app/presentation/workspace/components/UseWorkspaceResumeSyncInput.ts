import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { WorkspaceMode } from './WorkspaceMode';

export type UseWorkspaceResumeSyncInput = {
  onCommunitiesReload: () => Promise<void>;
  refreshConversations: () => Promise<ConversationResource[]>;
  workspaceMode: WorkspaceMode;
};
