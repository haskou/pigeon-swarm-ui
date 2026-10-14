import type { Dispatch, SetStateAction } from 'react';

import { useCallback, useState } from 'react';

import type { ConversationResource } from '../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../contexts/identities/infrastructure/session/Session';

import { useCommunities } from '../../contexts/communities/presentation/hooks/useCommunities';
import {
  clearCommunityInviteUrl,
  parseCommunityInviteUrl,
  type PendingCommunityInviteLink,
} from '../../contexts/communities/presentation/view-models/communityInviteLink';
import { useNodeNetworks } from '../../contexts/networks/presentation/hooks/useNodeNetworks';
import { usePeers } from '../../contexts/networks/presentation/hooks/usePeers';
import { clearProjectedMessageCaches } from '../../shared/infrastructure/storage/clearProjectedMessageCaches';
import { applicationContainer } from '../composition/applicationContainer';
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
      // Persisted sends resume once their session is open. A failed load keeps
      // the rows sealed for the next unlock.
      applicationContainer.directMessages
        .resumeOutbox(nextSession)
        .catch(() => undefined);
      applicationContainer.groupMessages
        .resume(nextSession)
        .catch(() => undefined);
    },
    [],
  );

  const clearSession = useCallback(() => {
    if (session) {
      applicationContainer.directMessages.stopOutbox(session.identity.id);
      applicationContainer.groupMessages.stop(session.identity.id);
    }
    closeAllRealtimeConnections();
    applicationContainer.disposeSessionWorkers();
    void clearProjectedMessageCaches();
    setSession(null);
  }, [session]);

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
