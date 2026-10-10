export type ConversationTimelineLoadAction = 'clear' | 'load' | 'preserve';

type ConversationTimelineLoadContext = {
  activeConversationId?: string;
  activeConversationKeyAvailable: boolean;
  loadedConversationId: null | string;
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

    if (context.loadedConversationId === context.activeConversationId) {
      return 'preserve';
    }

    return 'load';
  }
}
