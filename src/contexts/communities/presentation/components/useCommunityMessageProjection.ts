import { useCallback, useEffect, useRef } from 'react';

import type {
  ChatMessage,
  MessageResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { CommunityMessageDecryptWorkerClient } from '../../infrastructure/crypto/CommunityMessageDecryptWorkerClient';

type UseCommunityMessageProjectionInput = {
  communityId: string;
  session: Session;
};

type UseCommunityMessageProjectionResult = {
  loadChannelMessages: (
    channelId: string,
    beforeMessageId?: string,
    options?: { limit?: number },
  ) => Promise<{ cursor: null | string; loadedMessages: ChatMessage[] }>;
  projectChannelMessage: (
    channelId: string,
    rawMessage: MessageResource,
  ) => Promise<ChatMessage>;
  projectChannelMessages: (
    channelId: string,
    rawMessages: MessageResource[],
  ) => Promise<ChatMessage[]>;
};

export function useCommunityMessageProjection({
  communityId,
  session,
}: UseCommunityMessageProjectionInput): UseCommunityMessageProjectionResult {
  const decryptWorkerRef = useRef<CommunityMessageDecryptWorkerClient | null>(
    null,
  );
  const projectChannelMessages = useCallback(
    async (channelId: string, rawMessages: MessageResource[]) => {
      decryptWorkerRef.current ??= new CommunityMessageDecryptWorkerClient();

      const opened = await applicationContainer.mls.openMessages(
        session,
        communityId,
        rawMessages,
      );

      return await decryptWorkerRef.current.decrypt({
        channelId,
        communityId,
        copy: copy.messages,
        currentIdentityId: session.identity.id,
        messages: opened,
      });
    },
    [communityId, session],
  );
  const projectChannelMessage = useCallback(
    async (
      channelId: string,
      rawMessage: MessageResource,
    ): Promise<ChatMessage> => {
      const [projected] = await projectChannelMessages(channelId, [rawMessage]);

      return projected;
    },
    [projectChannelMessages],
  );
  const loadChannelMessages = useCallback(
    async (
      channelId: string,
      beforeMessageId?: string,
      options: { limit?: number } = {},
    ) => {
      const result = await applicationContainer.communities.listChannelMessages(
        session,
        communityId,
        channelId,
        { beforeMessageId, limit: options.limit },
      );
      const loadedMessages = await projectChannelMessages(
        channelId,
        result.messages,
      );

      return {
        cursor: result.nextBeforeMessageId ?? null,
        loadedMessages,
      };
    },
    [communityId, projectChannelMessages, session],
  );

  useEffect(
    () => () => {
      decryptWorkerRef.current?.terminate();
      decryptWorkerRef.current = null;
    },
    [],
  );

  return { loadChannelMessages, projectChannelMessage, projectChannelMessages };
}
