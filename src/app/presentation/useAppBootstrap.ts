import type { Dispatch, SetStateAction } from 'react';

import { useCallback, useEffect, useState } from 'react';

import type {
  ConversationResource,
  Session,
} from '../../shared/domain/pigeonResources.types';

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
import { requestPwaNotificationPermission } from '../../modules/notifications/infrastructure/browser/pwaNotifications';
import { pigeonApplication } from '../composition/applicationContainer';

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
  const [restoreState, setRestoreState] = useState<RestoreState>(
    hasSavedCredentials ? 'loading' : 'done',
  );
  const nodeNetworks = useNodeNetworks(session);
  const peers = usePeers();
  const communities = useCommunities(session);
  const [pendingCommunityInvite, setPendingCommunityInvite] =
    useState<PendingCommunityInviteLink | null>(() =>
      parseCommunityInviteUrl(),
    );

  const handleAuthenticated = useCallback(
    (nextSession: Session, nextConversations: ConversationResource[]) => {
      setSession(nextSession);
      setConversations(nextConversations);
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

    void pigeonApplication
      .login(savedCredentials.identityId, savedCredentials.password)
      .then((result) => {
        handleAuthenticated(result.session, result.conversations);
        setRestoreState('done');
      })
      .catch(() => {
        setRestoreState('done');
      });
  }, [handleAuthenticated, nodeNetworks, restoreState, session]);

  useEffect(() => {
    void requestPwaNotificationPermission();
  }, []);

  const clearSession = useCallback(() => {
    clearSavedCredentials();
    setSession(null);
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
    session,
    setCommunities: communities.setCommunities,
    setConversations,
    setPendingCommunityInviteHandled,
    setSession,
  };
}
