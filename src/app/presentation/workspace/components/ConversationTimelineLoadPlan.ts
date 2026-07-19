export type ConversationTimelineLoadAction =
  | 'clear'
  | 'load'
  | 'preserve'
  | 'use-preloaded';

type ConversationTimelineLoadContext = {
  activeConversationId?: string;
  activeConversationKeyAvailable: boolean;
  loadedConversationId: null | string;
  preloadedConversationId: null | string;
  workspaceMode: 'community' | 'messages';
};

export class ConversationTimelineLoadPlan {
  public static decide(
    context: ConversationTimelineLoadContext,
  ): ConversationTimelineLoadAction {
    if (
      context.workspaceMode !== 'messages' ||
      !context.activeConversationId ||
      !context.activeConversationKeyAvailable
    ) {
      return 'clear';
    }

    if (context.preloadedConversationId === context.activeConversationId) {
      return 'use-preloaded';
    }

    if (context.loadedConversationId === context.activeConversationId) {
      return 'preserve';
    }

    return 'load';
  }
}
