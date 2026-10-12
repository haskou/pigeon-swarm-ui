import { useCallback, useEffect, useRef } from 'react';

import type { ConversationResource } from '../../../../shared/domain/pigeonResources.types';
import type { UseWorkspaceResumeSyncInput } from './UseWorkspaceResumeSyncInput';
import type { WorkspaceMode } from './WorkspaceMode';
import type { WorkspaceResumeSyncPlan } from './WorkspaceResumeSyncPlan';

import { MessageCollection } from '../../../../contexts/messages/presentation/view-models/MessageCollection';
import { isBrowserPageVisible } from './isBrowserPageVisible';

const MIN_RESUME_SYNC_INTERVAL_MS = 1500;

export function workspaceResumeSyncPlan({
  workspaceMode,
  workspaceWasHidden,
}: {
  workspaceMode: WorkspaceMode;
  workspaceWasHidden: boolean;
}): WorkspaceResumeSyncPlan {
  return {
    refreshConversations: workspaceMode === 'messages',
    reloadCommunities: workspaceMode === 'community' && workspaceWasHidden,
  };
}

async function reloadActiveMessageIfBehind(
  input: UseWorkspaceResumeSyncInput,
  conversations: ConversationResource[],
): Promise<void> {
  const { activeConversationId, activeConversationKeyId } = input;

  if (
    input.workspaceMode !== 'messages' ||
    !activeConversationId ||
    !activeConversationKeyId
  ) {
    return;
  }

  const nextActiveConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  );

  if (
    nextActiveConversation &&
    !MessageCollection.isCaughtUpWithConversation(
      input.loadedMessages.current,
      nextActiveConversation,
    )
  ) {
    await input.loadActiveMessages(activeConversationId);
  }
}

async function syncWorkspaceAfterResume(
  input: UseWorkspaceResumeSyncInput,
  workspaceWasHidden: boolean,
): Promise<void> {
  const plan = workspaceResumeSyncPlan({
    workspaceMode: input.workspaceMode,
    workspaceWasHidden,
  });
  const nextConversations = plan.refreshConversations
    ? await input.refreshConversations().catch(() => null)
    : null;

  if (nextConversations) {
    await reloadActiveMessageIfBehind(input, nextConversations);
  }

  if (plan.reloadCommunities) {
    await input.onCommunitiesReload().catch(() => undefined);
  }
}

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
  const workspaceResumeSyncAtRef = useRef(Date.now());

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

    void syncWorkspaceAfterResume(
      {
        activeConversationId,
        activeConversationKeyId,
        loadActiveMessages,
        loadedMessages,
        onCommunitiesReload,
        refreshConversations,
        workspaceMode,
      },
      workspaceWasHidden,
    );
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
