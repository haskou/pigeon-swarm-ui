import type { ChatMessage } from '../../../../contexts/messages/domain/ChatMessage';
import type { ConversationThread } from './ConversationThread';

import { ThreadMessageVisibility } from '../../../../contexts/messages/presentation/view-models/ThreadMessageVisibility';

// Rebuilds an open thread from the conversation timeline; the thread closes
// once its root message is no longer in that timeline.
export function syncConversationThread(
  currentThread: ConversationThread,
  messages: ChatMessage[],
): ConversationThread | null {
  const root = messages.find((message) => message.id === currentThread.root.id);

  if (!root) return null;

  return {
    ...currentThread,
    messages: ThreadMessageVisibility.forRoot(root.id, messages),
    root,
  };
}
