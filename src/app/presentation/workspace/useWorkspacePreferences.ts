import type { Dispatch, SetStateAction } from 'react';

import { useEffect, useState } from 'react';

import type { ConversationResource } from '../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../contexts/identities/infrastructure/session/Session';
import type { CommunityUnreadCounts } from './components/CommunityUnreadCounts';
import type { WorkspaceMode } from './components/WorkspaceMode';
import type { WorkspacePreference } from './components/WorkspacePreference';

import { DraftPayloadCipher } from '../../../contexts/messages/infrastructure/crypto/DraftPayloadCipher';
import {
  writeJsonToLocalStorage,
  writeStringToLocalStorage,
} from '../../../shared/infrastructure/storage/jsonLocalStorage';
import {
  communityUnreadStorageKey,
  type ConversationDrafts,
  draftsStorageKey,
  encryptedDraftsStorageValue,
  initialConversationId,
  lastConversationStorageKey,
  loadEncryptedDraftPayloads,
  loadCommunityUnreadCounts,
  loadWorkspacePreference,
  workspaceStorageKey,
} from './components/workspacePersistence';

const draftPayloadCipher = new DraftPayloadCipher();

function encryptDrafts(
  session: Session,
  drafts: ConversationDrafts,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(drafts)
      .filter(([, content]) => content.trim().length > 0)
      .map(([conversationId, content]) => [
        conversationId,
        draftPayloadCipher.encrypt(session, content),
      ]),
  );
}

function decryptStoredDrafts(session: Session): ConversationDrafts {
  return Object.fromEntries(
    Object.entries(loadEncryptedDraftPayloads(session.identity.id)).flatMap(
      ([conversationId, payload]): [string, string][] => {
        const content = draftPayloadCipher.decrypt(session, payload);

        return content === null ? [] : [[conversationId, content]];
      },
    ),
  );
}

export function useWorkspacePreferences(input: {
  activeConversationId: string | null;
  activeCommunityId: string | null;
  communityChannelById: Record<string, string>;
  communityUnreadCountsById: CommunityUnreadCounts;
  drafts: ConversationDrafts;
  draftsHydrated: boolean;
  identityId: string;
  session: Session;
  workspaceMode: WorkspaceMode;
}): void {
  const {
    activeCommunityId,
    activeConversationId,
    communityChannelById,
    communityUnreadCountsById,
    drafts,
    draftsHydrated,
    identityId,
    session,
    workspaceMode,
  } = input;

  useEffect(() => {
    if (!draftsHydrated) return;

    writeJsonToLocalStorage(
      draftsStorageKey(identityId),
      encryptedDraftsStorageValue(encryptDrafts(session, drafts)),
    );
  }, [drafts, draftsHydrated, identityId, session]);

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
  session: Session,
): {
  activeCommunityId: string | null;
  activeConversationId: string | null;
  communityChannelById: Record<string, string>;
  communityUnreadCountsById: CommunityUnreadCounts;
  drafts: ConversationDrafts;
  draftsHydrated: boolean;
  setActiveCommunityId: Dispatch<SetStateAction<string | null>>;
  setActiveConversationId: Dispatch<SetStateAction<string | null>>;
  setCommunityChannelById: Dispatch<SetStateAction<Record<string, string>>>;
  setCommunityUnreadCountsById: Dispatch<SetStateAction<CommunityUnreadCounts>>;
  setDrafts: Dispatch<SetStateAction<ConversationDrafts>>;
  setWorkspaceMode: Dispatch<SetStateAction<WorkspaceMode>>;
  workspaceMode: WorkspaceMode;
} {
  const identityId = session.identity.id;
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
  const [drafts, setDrafts] = useState<ConversationDrafts>({});
  const [draftsHydrated, setDraftsHydrated] = useState(false);

  useEffect(() => {
    setCommunityUnreadCountsById(loadCommunityUnreadCounts(identityId));
    setWorkspacePreference(loadWorkspacePreference(identityId));
    setDrafts(decryptStoredDrafts(session));
    setDraftsHydrated(true);
  }, [identityId, session]);

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
    draftsHydrated,
    setActiveCommunityId,
    setActiveConversationId,
    setCommunityChannelById,
    setCommunityUnreadCountsById,
    setDrafts,
    setWorkspaceMode,
    workspaceMode,
  };
}
