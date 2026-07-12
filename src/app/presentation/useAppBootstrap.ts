import type { Dispatch, SetStateAction } from 'react';

import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  ConversationResource,
  Session,
} from '../../shared/domain/pigeonResources.types';
import type { LoginIdentityProgressStep } from '../../contexts/identities/application/login-identity/LoginIdentityProgressStep';
import type { PreloadedConversationMessages } from './workspace/PreloadedConversationMessages';

import { useCommunities } from '../../contexts/communities/presentation/hooks/useCommunities';
import {
  clearCommunityInviteUrl,
  parseCommunityInviteUrl,
  type PendingCommunityInviteLink,
} from '../../contexts/communities/presentation/view-models/communityInviteLink';
import {
  clearSavedCredentials,
  loadSavedCredentials,
} from '../../contexts/identities/infrastructure/storage/savedCredentials';
import { clearLocalDeviceUnlock } from '../../contexts/identities/infrastructure/storage/localDeviceUnlock';
import {
  loadRememberedIdentityPreview,
  type RememberedIdentityPreview,
} from '../../contexts/identities/infrastructure/storage/rememberedIdentityPreview';
import { useNodeNetworks } from '../../contexts/networks/presentation/hooks/useNodeNetworks';
import { usePeers } from '../../contexts/networks/presentation/hooks/usePeers';
import { loadApplicationContainer } from '../composition/loadApplicationContainer';
import {
  initialConversationId,
  loadWorkspacePreference,
} from './workspace/components/workspacePersistence';
import { preloadGlassWorkspaceModule } from './workspace/loadGlassWorkspaceModule';

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
  restoreIdentityPreview: RememberedIdentityPreview | null;
  restoreProgressStep: LoginIdentityProgressStep | null;
  session: Session | null;
  setCommunities: ReturnType<typeof useCommunities>['setCommunities'];
  setConversations: Dispatch<SetStateAction<ConversationResource[]>>;
  setPendingCommunityInviteHandled: () => void;
  setSession: React.Dispatch<React.SetStateAction<Session | null>>;
} {
  const [hasSavedCredentials] = useState(() => loadSavedCredentials() !== null);
  const [restoreIdentityPreview] = useState<RememberedIdentityPreview | null>(
    () => {
      const savedCredentials = loadSavedCredentials();

      if (!savedCredentials) return null;

      return loadRememberedIdentityPreview(savedCredentials.identityId);
    },
  );
  const [session, setSession] = useState<Session | null>(null);
  const [conversations, setConversations] = useState<ConversationResource[]>(
    [],
  );
  const [preloadedConversationMessages, setPreloadedConversationMessages] =
    useState<PreloadedConversationMessages | null>(null);
  const [restoreState, setRestoreState] = useState<RestoreState>(
    hasSavedCredentials ? 'loading' : 'done',
  );
  const [restoreProgressStep, setRestoreProgressStep] =
    useState<LoginIdentityProgressStep | null>(null);
  const restoreInFlightRef = useRef(false);
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

    if (restoreInFlightRef.current) return;

    const savedCredentials = loadSavedCredentials();

    if (!savedCredentials) {
      setRestoreProgressStep(null);
      setRestoreState('done');

      return;
    }

    restoreInFlightRef.current = true;
    setRestoreProgressStep('resolving-identity');
    void loadApplicationContainer()
      .then(async (applicationContainer) => {
        const [result] = await Promise.all([
          applicationContainer.session.restoreRemembered(
            savedCredentials.identityId,
            setRestoreProgressStep,
          ),
          preloadGlassWorkspaceModule(),
        ]);
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
        setRestoreProgressStep(null);
        setRestoreState('done');
        restoreInFlightRef.current = false;
      })
      .catch(() => {
        void clearLocalDeviceUnlock().catch(() => undefined);
        clearSavedCredentials();
        setRestoreProgressStep(null);
        setRestoreState('done');
        restoreInFlightRef.current = false;
      });
  }, [
    handleAuthenticated,
    nodeNetworks.error,
    nodeNetworks.loading,
    nodeNetworks.networks.length,
    restoreState,
    session,
  ]);

  const clearSession = useCallback(() => {
    void clearLocalDeviceUnlock().catch(() => undefined);
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
    restoreIdentityPreview,
    restoreProgressStep,
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
    const result = await applicationContainer.messages.load(
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
