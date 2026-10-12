import type { ConversationTimelineLoadAction } from './ConversationTimelineLoadAction';
import type { ConversationTimelineLoadContext } from './ConversationTimelineLoadContext';

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
