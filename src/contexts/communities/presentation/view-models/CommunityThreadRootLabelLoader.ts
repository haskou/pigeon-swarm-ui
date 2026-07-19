import type {
  ChatMessage,
  MessageResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { threadRootLabelKey } from '../components/communityThreadState';
import { CommunityThreadRootLabels } from './CommunityThreadRootLabels';

const MAX_THREAD_ROOT_PAGES = 8;

export class CommunityThreadRootLabelLoader {
  public constructor(
    private readonly communityId: string,
    private readonly session: Session,
    private readonly projectMessages: (
      channelId: string,
      messages: MessageResource[],
    ) => Promise<ChatMessage[]>,
  ) {}

  private async loadChannel(
    channel: ReturnType<typeof CommunityThreadRootLabels.missing>[number],
    cancelled: () => boolean,
  ): Promise<{
    hiddenKeys: string[];
    labels: Record<string, string>;
    unresolvedKeys: string[];
  }> {
    const hiddenKeys: string[] = [];
    const labels: Record<string, string> = {};
    const remainingMessageIds = new Set(channel.rootMessageIds);
    let beforeMessageId: string | undefined;

    for (let page = 0; page < MAX_THREAD_ROOT_PAGES; page += 1) {
      if (cancelled() || remainingMessageIds.size === 0) break;

      const result = await applicationContainer.communities.listChannelMessages(
        this.session,
        this.communityId,
        channel.channelId,
        { beforeMessageId },
      );
      const messages = await this.projectMessages(
        channel.channelId,
        result.messages,
      );
      const classification = CommunityThreadRootLabels.classify(
        channel.channelId,
        messages,
        remainingMessageIds,
      );

      classification.resolvedMessageIds.forEach((messageId) => {
        remainingMessageIds.delete(messageId);
      });
      hiddenKeys.push(...classification.hiddenKeys);
      Object.assign(labels, classification.labels);

      if (!result.nextBeforeMessageId) break;

      beforeMessageId = result.nextBeforeMessageId;
    }

    return {
      hiddenKeys,
      labels,
      unresolvedKeys: [...remainingMessageIds].map((messageId) =>
        threadRootLabelKey(channel.channelId, messageId),
      ),
    };
  }

  public async load(
    missingRoots: ReturnType<typeof CommunityThreadRootLabels.missing>,
    cancelled: () => boolean,
  ): Promise<{
    hiddenKeys: string[];
    labels: Record<string, string>;
    unresolvedKeys: string[];
  }> {
    const hiddenKeys: string[] = [];
    const labels: Record<string, string> = {};
    const unresolvedKeys: string[] = [];

    for (const channel of missingRoots) {
      if (cancelled()) break;

      const result = await this.loadChannel(channel, cancelled);

      hiddenKeys.push(...result.hiddenKeys);
      Object.assign(labels, result.labels);
      unresolvedKeys.push(...result.unresolvedKeys);
    }

    return { hiddenKeys, labels, unresolvedKeys };
  }
}
