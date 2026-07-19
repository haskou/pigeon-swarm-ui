import type {
  ChatMessage,
  CommunityTextChannel,
} from '../../../../shared/domain/pigeonResources.types';

import {
  isThreadRootMessage,
  threadRootLabelKey,
  threadTitleFromMessage,
} from '../components/communityThreadState';

export class CommunityThreadRootLabels {
  public static merge(
    current: Record<string, string>,
    incoming: Record<string, string>,
  ): Record<string, string> {
    for (const [messageId, label] of Object.entries(incoming)) {
      if (current[messageId] !== label) return { ...current, ...incoming };
    }

    return current;
  }

  public static missing(
    channels: CommunityTextChannel[],
    labels: Record<string, string>,
    unresolvedKeys: ReadonlySet<string>,
  ): { channelId: string; rootMessageIds: string[] }[] {
    return channels
      .map((channel) => ({
        channelId: channel.id,
        rootMessageIds: [
          ...new Set(
            (channel.threads ?? [])
              .map((thread) => thread.rootMessageId)
              .filter(
                (rootMessageId) =>
                  !labels[rootMessageId] &&
                  !unresolvedKeys.has(
                    threadRootLabelKey(channel.id, rootMessageId),
                  ),
              ),
          ),
        ],
      }))
      .filter((channel) => channel.rootMessageIds.length > 0);
  }

  public static classify(
    channelId: string,
    messages: ChatMessage[],
    requestedMessageIds: ReadonlySet<string>,
  ): {
    hiddenKeys: string[];
    labels: Record<string, string>;
    resolvedMessageIds: string[];
  } {
    const hiddenKeys: string[] = [];
    const labels: Record<string, string> = {};
    const resolvedMessageIds: string[] = [];

    for (const message of messages) {
      if (!requestedMessageIds.has(message.id)) continue;

      resolvedMessageIds.push(message.id);

      if (isThreadRootMessage(message)) {
        labels[message.id] = threadTitleFromMessage(message);
      } else {
        hiddenKeys.push(threadRootLabelKey(channelId, message.id));
      }
    }

    return { hiddenKeys, labels, resolvedMessageIds };
  }
}
