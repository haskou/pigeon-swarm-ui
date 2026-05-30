import { useCallback, useEffect, useRef } from 'react';

import type {
  ChatMessage,
  ConversationResource,
} from '../../../../shared/domain/pigeonResources.types';

import { MessageCollection } from '../../../../modules/messages/domain/MessageCollection';
import { isBrowserPageVisible } from './isBrowserPageVisible';

const MIN_RESUME_SYNC_INTERVAL_MS = 1500;

type WorkspaceMode = 'community' | 'messages';

type UseWorkspaceResumeSyncInput = {
  activeConversationId?: string | null;
  activeConversationKeyId?: string | null;
  loadActiveMessages: (conversationId: string) => Promise<void>;
  loadedMessages: { current: ChatMessage[] };
  onCommunitiesReload: () => Promise<void>;
  refreshConversations: () => Promise<ConversationResource[]>;
  workspaceMode: WorkspaceMode;
};

export function useWorkspaceResumeSync({
  activeConversationId,
  activeConversationKeyId,
  loadActiveMessages,
  loadedMessages,
  onCommunitiesReload,
  refreshConversations,
  workspaceMode,
}: UseWorkspaceResumeSyncInput): void {
  const workspaceWasHiddenRef = useRef(!isBrowserPageVisible());
  const workspaceResumeSyncAtRef = useRef(0);

  const syncVisibleWorkspace = useCallback(() => {
    if (!isBrowserPageVisible()) {
      workspaceWasHiddenRef.current = true;

      return;
    }

    const now = Date.now();

    if (now - workspaceResumeSyncAtRef.current < MIN_RESUME_SYNC_INTERVAL_MS) {
      return;
    }

    const workspaceWasHidden = workspaceWasHiddenRef.current;

    workspaceWasHiddenRef.current = false;
    workspaceResumeSyncAtRef.current = now;

    void (async () => {
      const nextConversations = await refreshConversations().catch(
        () => null,
      );

      if (
        workspaceMode === 'messages' &&
        activeConversationId &&
        activeConversationKeyId &&
        nextConversations
      ) {
        const nextActiveConversation = nextConversations.find(
          (conversation) => conversation.id === activeConversationId,
        );

        if (
          nextActiveConversation &&
          !MessageCollection.isCaughtUpWithConversation(
            loadedMessages.current,
            nextActiveConversation,
          )
        ) {
          await loadActiveMessages(activeConversationId);
        }
      }

      if (workspaceMode === 'community' && workspaceWasHidden) {
        await onCommunitiesReload().catch(() => undefined);
      }
    })();
  }, [
    activeConversationId,
    activeConversationKeyId,
    loadActiveMessages,
    loadedMessages,
    onCommunitiesReload,
    refreshConversations,
    workspaceMode,
  ]);

  const markWorkspaceHidden = useCallback(() => {
    workspaceWasHiddenRef.current = true;
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    document.addEventListener('visibilitychange', syncVisibleWorkspace);
    window.addEventListener('pagehide', markWorkspaceHidden);
    window.addEventListener('focus', syncVisibleWorkspace);
    window.addEventListener('pageshow', syncVisibleWorkspace);

    return () => {
      document.removeEventListener('visibilitychange', syncVisibleWorkspace);
      window.removeEventListener('pagehide', markWorkspaceHidden);
      window.removeEventListener('focus', syncVisibleWorkspace);
      window.removeEventListener('pageshow', syncVisibleWorkspace);
    };
  }, [markWorkspaceHidden, syncVisibleWorkspace]);
}
