import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';
import type { CommunityThreadState } from '../components/communityThreadState';

import {
  isThreadRootMessage,
  threadTitleFromMessage,
} from '../components/communityThreadState';

export class CommunityThreadLabelIndex {
  public static byRootMessageId({
    knownLabels,
    messages,
    threadPanel,
  }: {
    knownLabels: Record<string, string>;
    messages: ChatMessage[];
    threadPanel: CommunityThreadState | null;
  }): Record<string, string> {
    const labels: Record<string, string> = { ...knownLabels };

    for (const message of messages) {
      if (isThreadRootMessage(message)) {
        labels[message.id] = threadTitleFromMessage(message);
      }
    }

    if (threadPanel) {
      labels[threadPanel.root.id] = threadTitleFromMessage(threadPanel.root);
    }

    return labels;
  }

  public static fromVisibleMessages({
    collectionMessages,
    messages,
    searchResultMessages,
    threadPanel,
  }: {
    collectionMessages: ChatMessage[];
    messages: ChatMessage[];
    searchResultMessages: ChatMessage[];
    threadPanel: CommunityThreadState | null;
  }): Record<string, string> {
    const labels: Record<string, string> = {};
    const remember = (message: ChatMessage) => {
      if (!isThreadRootMessage(message)) return;

      labels[message.id] = threadTitleFromMessage(message);
    };

    messages.forEach(remember);

    if (threadPanel) remember(threadPanel.root);

    collectionMessages.forEach(remember);
    searchResultMessages.forEach(remember);

    return labels;
  }
}
