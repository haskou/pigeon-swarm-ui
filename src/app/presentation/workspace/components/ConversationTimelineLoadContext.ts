export type ConversationTimelineLoadContext = {
  activeConversationId?: string;
  activeConversationKeyAvailable: boolean;
  loadedConversationId: null | string;
  workspaceMode: 'community' | 'messages';
};
