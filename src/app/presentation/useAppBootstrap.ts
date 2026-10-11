import type { Dispatch, SetStateAction } from 'react';

import { useCallback, useEffect, useState } from 'react';

import type {
  ConversationResource,
  Session,
} from '../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../composition/applicationContainer';
import { useCommunities } from '../../contexts/communities/presentation/hooks/useCommunities';
import {
  clearCommunityInviteUrl,
  parseCommunityInviteUrl,
  type PendingCommunityInviteLink,
} from '../../contexts/communities/presentation/view-models/communityInviteLink';
import { deleteLegacyLocalDeviceUnlockStore } from '../../contexts/identities/infrastructure/storage/deleteLegacyLocalDeviceUnlockStore';
import { deleteLegacyRememberedIdentityStorage } from '../../contexts/identities/infrastructure/storage/deleteLegacyRememberedIdentityStorage';
import { useNodeNetworks } from '../../contexts/networks/presentation/hooks/useNodeNetworks';
import { usePeers } from '../../contexts/networks/presentation/hooks/usePeers';
import { clearProjectedMessageCaches } from '../../shared/infrastructure/storage/clearProjectedMessageCaches';
import { closeAllRealtimeConnections } from './realtime/useRealtimeEvents';

export function useAppBootstrap(): {
  clearSession: () => void;
  communities: ReturnType<typeof useCommunities>;
  conversations: ConversationResource[];
  handleAuthenticated: (
    nextSession: Session,
    nextConversations: ConversationResource[],
  ) => void;
  handleNetworkCreated: () => void;
  nodeNetworks: ReturnType<typeof useNodeNetworks>;
  peers: ReturnType<typeof usePeers>;
  pendingCommunityInvite: PendingCommunityInviteLink | null;
  session: Session | null;
  setCommunities: ReturnType<typeof useCommunities>['setCommunities'];
  setConversations: Dispatch<SetStateAction<ConversationResource[]>>;
  setPendingCommunityInviteHandled: () => void;
  setSession: React.Dispatch<React.SetStateAction<Session | null>>;
} {
  const [session, setSession] = useState<Session | null>(null);
  const [conversations, setConversations] = useState<ConversationResource[]>(
    [],
  );
  const nodeNetworks = useNodeNetworks(session);
  const peers = usePeers({ deferAutoLoad: true });
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
    void deleteLegacyLocalDeviceUnlockStore();
    deleteLegacyRememberedIdentityStorage();
  }, []);

  const clearSession = useCallback(() => {
    closeAllRealtimeConnections();
    applicationContainer.disposeSessionWorkers();
    void clearProjectedMessageCaches();
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
