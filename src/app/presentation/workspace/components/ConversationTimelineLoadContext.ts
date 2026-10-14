export type ConversationTimelineLoadContext = {
  activeConversationId?: string;
  activeConversationReady: boolean;
  loadedConversationId: null | string;
  workspaceMode: 'community' | 'messages';
};
