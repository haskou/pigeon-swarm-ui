import { useCallback, useEffect, useRef } from 'react';

import type { UseWorkspaceResumeSyncInput } from './UseWorkspaceResumeSyncInput';
import type { WorkspaceMode } from './WorkspaceMode';
import type { WorkspaceResumeSyncPlan } from './WorkspaceResumeSyncPlan';

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

async function syncWorkspaceAfterResume(
  input: UseWorkspaceResumeSyncInput,
  workspaceWasHidden: boolean,
): Promise<void> {
  const plan = workspaceResumeSyncPlan({
    workspaceMode: input.workspaceMode,
    workspaceWasHidden,
  });

  if (plan.refreshConversations) {
    await input.refreshConversations().catch(() => null);
  }

  if (plan.reloadCommunities) {
    await input.onCommunitiesReload().catch(() => undefined);
  }
}

export function useWorkspaceResumeSync({
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
      { onCommunitiesReload, refreshConversations, workspaceMode },
      workspaceWasHidden,
    );
  }, [onCommunitiesReload, refreshConversations, workspaceMode]);

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
