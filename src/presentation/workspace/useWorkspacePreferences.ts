import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import type { ConversationResource } from '../../domain/types';

import {
  communityUnreadStorageKey,
  type CommunityUnreadCounts,
  type ConversationDrafts,
  draftsStorageKey,
  initialConversationId,
  lastConversationStorageKey,
  loadCommunityUnreadCounts,
  loadDrafts,
  loadWorkspacePreference,
  type WorkspacePreference,
  workspaceStorageKey,
} from '../../components/workspace/workspacePersistence';
import {
  writeJsonToLocalStorage,
  writeStringToLocalStorage,
} from '../../infrastructure/storage/JsonLocalStorage';

type WorkspaceMode = 'community' | 'messages';

export function useWorkspacePreferences(input: {
  activeConversationId: string | null;
  activeCommunityId: string | null;
  communityChannelById: Record<string, string>;
  communityUnreadCountsById: CommunityUnreadCounts;
  drafts: ConversationDrafts;
  identityId: string;
  workspaceMode: WorkspaceMode;
}): void {
  const {
    activeConversationId,
    activeCommunityId,
    communityChannelById,
    communityUnreadCountsById,
    drafts,
    identityId,
    workspaceMode,
  } = input;

  useEffect(() => {
    writeJsonToLocalStorage(draftsStorageKey(identityId), drafts);
  }, [drafts, identityId]);

  useEffect(() => {
    if (!activeConversationId) return;

    writeStringToLocalStorage(
      lastConversationStorageKey(identityId),
      activeConversationId,
    );
  }, [activeConversationId, identityId]);

  useEffect(() => {
    const preference: WorkspacePreference = {
      channelByCommunityId: communityChannelById,
      communityId: activeCommunityId,
      mode: workspaceMode,
    };

    writeJsonToLocalStorage(workspaceStorageKey(identityId), preference);
  }, [activeCommunityId, communityChannelById, identityId, workspaceMode]);

  useEffect(() => {
    writeJsonToLocalStorage(
      communityUnreadStorageKey(identityId),
      communityUnreadCountsById,
    );
  }, [communityUnreadCountsById, identityId]);
}

export function useWorkspacePreferenceState(
  conversations: ConversationResource[],
  identityId: string,
): {
  activeCommunityId: string | null;
  activeConversationId: string | null;
  communityChannelById: Record<string, string>;
  communityUnreadCountsById: CommunityUnreadCounts;
  drafts: ConversationDrafts;
  setActiveCommunityId: Dispatch<SetStateAction<string | null>>;
  setActiveConversationId: Dispatch<SetStateAction<string | null>>;
  setCommunityChannelById: Dispatch<SetStateAction<Record<string, string>>>;
  setCommunityUnreadCountsById: Dispatch<SetStateAction<CommunityUnreadCounts>>;
  setDrafts: Dispatch<SetStateAction<ConversationDrafts>>;
  setWorkspaceMode: Dispatch<SetStateAction<WorkspaceMode>>;
  workspaceMode: WorkspaceMode;
} {
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(() => initialConversationId(conversations, identityId));
  const [workspacePreference, setWorkspacePreference] =
    useState<WorkspacePreference>(() => loadWorkspacePreference(identityId));
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(
    workspacePreference.mode ?? 'messages',
  );
  const [activeCommunityId, setActiveCommunityId] = useState<string | null>(
    workspacePreference.communityId ?? null,
  );
  const [communityChannelById, setCommunityChannelById] = useState<
    Record<string, string>
  >(() => workspacePreference.channelByCommunityId ?? {});
  const [communityUnreadCountsById, setCommunityUnreadCountsById] =
    useState<CommunityUnreadCounts>(() =>
      loadCommunityUnreadCounts(identityId),
    );
  const [drafts, setDrafts] = useState<ConversationDrafts>(() =>
    loadDrafts(identityId),
  );

  useEffect(() => {
    setDrafts(loadDrafts(identityId));
    setCommunityUnreadCountsById(loadCommunityUnreadCounts(identityId));
    setWorkspacePreference(loadWorkspacePreference(identityId));
  }, [identityId]);

  useEffect(() => {
    setWorkspaceMode(workspacePreference.mode ?? 'messages');
    setActiveCommunityId(workspacePreference.communityId ?? null);
    setCommunityChannelById(workspacePreference.channelByCommunityId ?? {});
  }, [workspacePreference]);

  return {
    activeCommunityId,
    activeConversationId,
    communityChannelById,
    communityUnreadCountsById,
    drafts,
    setActiveCommunityId,
    setActiveConversationId,
    setCommunityChannelById,
    setCommunityUnreadCountsById,
    setDrafts,
    setWorkspaceMode,
    workspaceMode,
  };
}
