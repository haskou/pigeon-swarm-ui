import type { Dispatch, SetStateAction } from 'react';

import { useCallback, useEffect, useState } from 'react';

import type {
  ConversationResource,
  Session,
} from '../../shared/domain/pigeonResources.types';
import type { PreloadedConversationMessages } from './workspace/PreloadedConversationMessages';

import { useCommunities } from '../../modules/communities/presentation/hooks/useCommunities';
import {
  clearCommunityInviteUrl,
  parseCommunityInviteUrl,
  type PendingCommunityInviteLink,
} from '../../modules/communities/presentation/view-models/communityInviteLink';
import {
  clearSavedCredentials,
  loadSavedCredentials,
} from '../../modules/identities/infrastructure/storage/savedCredentials';
import { useNodeNetworks } from '../../modules/networks/presentation/hooks/useNodeNetworks';
import { usePeers } from '../../modules/networks/presentation/hooks/usePeers';
import { loadApplicationContainer } from '../composition/loadApplicationContainer';
import {
  initialConversationId,
  loadWorkspacePreference,
} from './workspace/components/workspacePersistence';

type RestoreState = 'done' | 'loading';

export function useAppBootstrap(): {
  clearSession: () => void;
  communities: ReturnType<typeof useCommunities>;
  conversations: ConversationResource[];
  handleAuthenticated: (
    nextSession: Session,
    nextConversations: ConversationResource[],
  ) => void;
  handleNetworkCreated: () => void;
  isRestoringSession: boolean;
  nodeNetworks: ReturnType<typeof useNodeNetworks>;
  peers: ReturnType<typeof usePeers>;
  pendingCommunityInvite: PendingCommunityInviteLink | null;
  preloadedConversationMessages: PreloadedConversationMessages | null;
  session: Session | null;
  setCommunities: ReturnType<typeof useCommunities>['setCommunities'];
  setConversations: Dispatch<SetStateAction<ConversationResource[]>>;
  setPendingCommunityInviteHandled: () => void;
  setSession: React.Dispatch<React.SetStateAction<Session | null>>;
} {
  const [hasSavedCredentials] = useState(() => loadSavedCredentials() !== null);
  const [session, setSession] = useState<Session | null>(null);
  const [conversations, setConversations] = useState<ConversationResource[]>(
    [],
  );
  const [preloadedConversationMessages, setPreloadedConversationMessages] =
    useState<PreloadedConversationMessages | null>(null);
  const [restoreState, setRestoreState] = useState<RestoreState>(
    hasSavedCredentials ? 'loading' : 'done',
  );
  const nodeNetworks = useNodeNetworks(session);
  const peers = usePeers({ deferAutoLoad: true });
  const communities = useCommunities(session);
  const [pendingCommunityInvite, setPendingCommunityInvite] =
    useState<PendingCommunityInviteLink | null>(() =>
      parseCommunityInviteUrl(),
    );

  const handleAuthenticated = useCallback(
    (
      nextSession: Session,
      nextConversations: ConversationResource[],
      nextPreloadedConversationMessages: PreloadedConversationMessages | null =
        null,
    ) => {
      setSession(nextSession);
      setConversations(nextConversations);
      setPreloadedConversationMessages(nextPreloadedConversationMessages);
    },
    [],
  );

  useEffect(() => {
    if (nodeNetworks.loading || nodeNetworks.error || session) return;

    if (nodeNetworks.networks.length === 0) return;

    if (restoreState !== 'loading') return;

    const savedCredentials = loadSavedCredentials();

    if (!savedCredentials) {
      setRestoreState('done');

      return;
    }

    void loadApplicationContainer()
      .then(async (applicationContainer) => {
        const result = await applicationContainer.login(
          savedCredentials.identityId,
          savedCredentials.password,
        );
        const preloadedConversationMessages =
          await preloadInitialConversationMessages(
            applicationContainer,
            result.session,
            result.conversations,
          );
        return { ...result, preloadedConversationMessages };
      })
      .then((result) => {
        handleAuthenticated(
          result.session,
          result.conversations,
          result.preloadedConversationMessages,
        );
        setRestoreState('done');
      })
      .catch(() => {
        setRestoreState('done');
      });
  }, [handleAuthenticated, nodeNetworks, restoreState, session]);

  const clearSession = useCallback(() => {
    clearSavedCredentials();
    setSession(null);
    setPreloadedConversationMessages(null);
  }, []);

  const handleNetworkCreated = useCallback(() => {
    window.location.reload();
  }, []);

  const setPendingCommunityInviteHandled = useCallback(() => {
    clearCommunityInviteUrl();
    setPendingCommunityInvite(null);
  }, []);

  return {
    clearSession,
    communities,
    conversations,
    handleAuthenticated,
    handleNetworkCreated,
    isRestoringSession: restoreState === 'loading',
    nodeNetworks,
    peers,
    pendingCommunityInvite,
    preloadedConversationMessages,
    session,
    setCommunities: communities.setCommunities,
    setConversations,
    setPendingCommunityInviteHandled,
    setSession,
  };
}

async function preloadInitialConversationMessages(
  applicationContainer: Awaited<ReturnType<typeof loadApplicationContainer>>,
  session: Session,
  conversations: ConversationResource[],
): Promise<PreloadedConversationMessages | null> {
  const workspacePreference = loadWorkspacePreference(session.identity.id);

  if (workspacePreference.mode === 'community') return null;

  const conversationId = initialConversationId(
    conversations,
    session.identity.id,
  );

  if (!conversationId) return null;

  try {
    const result = await applicationContainer.loadMessages(
      session,
      conversationId,
      null,
    );

    return {
      conversationId,
      messages: result.messages,
      nextCursor: result.nextCursor ?? null,
    };
  } catch {
    return null;
  }
}
