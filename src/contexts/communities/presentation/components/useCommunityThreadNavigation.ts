import { useCallback, type Dispatch, type SetStateAction } from 'react';

import type {
  ChatMessage,
  CommunityChannelThreadSummary,
  MessageResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { MessageContextMenuState } from '../../../../app/presentation/workspace/components/messageContextMenu';
import type { CommunityThreadState } from './communityThreadState';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { ThreadMessageVisibility } from '../../../messages/presentation/view-models/ThreadMessageVisibility';
import { placeholderThreadRootMessage } from './communityThreadState';

type CommunityThreadNavigationInput = {
  communityId: string;
  currentIdentityId: string;
  messages: ChatMessage[];
  onChannelSelected: (channelId: string) => void;
  projectMessages: (
    channelId: string,
    messages: MessageResource[],
  ) => Promise<ChatMessage[]>;
  selectedChannelId: null | string;
  session: Session;
  setMessageContextMenu: Dispatch<
    SetStateAction<MessageContextMenuState | null>
  >;
  setThreadPanel: Dispatch<SetStateAction<CommunityThreadState | null>>;
  upsertSummary: (
    channelId: string,
    summary: CommunityChannelThreadSummary,
  ) => void;
};

export function useCommunityThreadNavigation({
  communityId,
  currentIdentityId,
  messages,
  onChannelSelected,
  projectMessages,
  selectedChannelId,
  session,
  setMessageContextMenu,
  setThreadPanel,
  upsertSummary,
}: CommunityThreadNavigationInput) {
  const open = useCallback(
    async (message: ChatMessage) => {
      const channelId = message.raw.channelId ?? selectedChannelId;

      if (!channelId) return;

      if (channelId !== selectedChannelId) onChannelSelected(channelId);

      setMessageContextMenu(null);
      setThreadPanel(initialThreadState(channelId, message, 'loading'));
      try {
        const result =
          await applicationContainer.listCommunityChannelMessageThread(
            session,
            communityId,
            channelId,
            message.id,
          );
        const projected = await projectMessages(channelId, result.messages);
        const threadMessages = ThreadMessageVisibility.forRoot(
          message.id,
          ThreadMessageVisibility.markAsThreadMessages(message.id, projected),
        );

        setThreadPanel({
          ...initialThreadState(channelId, message, 'ready'),
          messages: threadMessages,
        });
        const lastReply = threadMessages[threadMessages.length - 1];

        if (lastReply) {
          upsertSummary(channelId, {
            lastReplyAt: lastReply.timestamp,
            lastReplyMessageId: lastReply.id,
            replyCount: threadMessages.length,
            rootMessageId: message.id,
          });
        }
      } catch (caught) {
        setThreadPanel({
          ...initialThreadState(channelId, message, 'ready'),
          error: toUserErrorMessage(caught, copy.messages.threadError),
        });
      }
    },
    [
      communityId,
      onChannelSelected,
      projectMessages,
      selectedChannelId,
      session,
      setMessageContextMenu,
      setThreadPanel,
      upsertSummary,
    ],
  );

  const loadRoot = useCallback(
    async (
      channelId: string,
      rootMessageId: string,
    ): Promise<ChatMessage | null> => {
      const loadedRoot = messages.find(
        (message) => message.id === rootMessageId,
      );

      if (loadedRoot) return loadedRoot;

      let beforeMessageId: null | string | undefined;

      for (let page = 0; page < 8; page += 1) {
        const result = await applicationContainer.listCommunityChannelMessages(
          session,
          communityId,
          channelId,
          { beforeMessageId: beforeMessageId ?? undefined },
        );
        const loadedMessages = await projectMessages(
          channelId,
          result.messages,
        );
        const root = loadedMessages.find(
          (message) => message.id === rootMessageId,
        );

        if (root) return root;
        if (!result.nextBeforeMessageId) break;

        beforeMessageId = result.nextBeforeMessageId;
      }

      return null;
    },
    [communityId, messages, projectMessages, session],
  );

  const openFromSummary = useCallback(
    async (channelId: string, summary: CommunityChannelThreadSummary) => {
      const root =
        (await loadRoot(channelId, summary.rootMessageId)) ??
        placeholderThreadRootMessage({
          channelId,
          communityId,
          currentIdentityId,
          rootMessageId: summary.rootMessageId,
        });

      await open(root);
    },
    [communityId, currentIdentityId, loadRoot, open],
  );

  return { open, openFromSummary };
}

function initialThreadState(
  channelId: string,
  root: ChatMessage,
  state: CommunityThreadState['state'],
): CommunityThreadState {
  return {
    channelId,
    draft: '',
    editingMessage: null,
    error: null,
    messages: [],
    replyTarget: null,
    root,
    state,
  };
}
