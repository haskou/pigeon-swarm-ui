import type { Dispatch, SetStateAction } from 'react';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { ConversationResource } from '../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../contexts/identities/infrastructure/session/Session';
import type { DeviceRemoval } from './DeviceRemoval';

import { useCommunities } from '../../contexts/communities/presentation/hooks/useCommunities';
import {
  clearCommunityInviteUrl,
  parseCommunityInviteUrl,
  type PendingCommunityInviteLink,
} from '../../contexts/communities/presentation/view-models/communityInviteLink';
import { deleteLegacyLocalDeviceUnlockStore } from '../../contexts/identities/infrastructure/storage/deleteLegacyLocalDeviceUnlockStore';
import { useNodeNetworks } from '../../contexts/networks/presentation/hooks/useNodeNetworks';
import { usePeers } from '../../contexts/networks/presentation/hooks/usePeers';
import { clearProjectedMessageCaches } from '../../shared/infrastructure/storage/clearProjectedMessageCaches';
import { applicationContainer } from '../composition/applicationContainer';
import { DeviceRemovalWatch } from './DeviceRemovalWatch';
import { eraseRemovedDevice } from './eraseRemovedDevice';
import { closeAllRealtimeConnections } from './realtime/useRealtimeEvents';

/** Stops the outboxes, realtime connections and workers of an ended session. */
function stopSessionWork(identityId: string | null): void {
  if (identityId) {
    applicationContainer.directMessages.stopOutbox(identityId);
    applicationContainer.groupMessages.stop(identityId);
  }
  closeAllRealtimeConnections();
  applicationContainer.disposeSessionWorkers();
}

export function useAppBootstrap(): {
  clearSession: () => void;
  communities: ReturnType<typeof useCommunities>;
  conversations: ConversationResource[];
  deviceRemoval: DeviceRemoval | null;
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
  const [deviceRemoval, setDeviceRemoval] = useState<DeviceRemoval | null>(
    null,
  );
  const sessionRef = useRef(session);
  const identityId = session?.identity.id ?? null;
  const nodeNetworks = useNodeNetworks(session);
  const peers = usePeers({ deferAutoLoad: true });
  const communities = useCommunities(session);
  const [pendingCommunityInvite, setPendingCommunityInvite] =
    useState<PendingCommunityInviteLink | null>(() =>
      parseCommunityInviteUrl(),
    );

  const handleAuthenticated = useCallback(
    (nextSession: Session, nextConversations: ConversationResource[]) => {
      setDeviceRemoval(null);
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
    stopSessionWork(session?.identity.id ?? null);
    void clearProjectedMessageCaches();
    setSession(null);
  }, [session]);

  useEffect(() => {
    void deleteLegacyLocalDeviceUnlockStore();
  }, []);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // While signed in, a revoke made on another device is verified from the
  // signed transitions within DeviceRemovalWatch.CHECK_INTERVAL_MS; the
  // session closes and this device is erased without waiting for a sign-in.
  useEffect(() => {
    if (!identityId) return;

    const watch = new DeviceRemovalWatch(
      () => sessionRef.current,
      (current) =>
        applicationContainer.identities.synchronizeDeviceAuthorization(current),
      {
        onAdvanced: (from, to) => {
          setSession((current) => (current === from ? to : current));
        },
        onRemoved: (removedIdentityId) => {
          stopSessionWork(removedIdentityId);
          setSession(null);
          setConversations([]);
          setDeviceRemoval({ identityId: removedIdentityId, state: 'erasing' });
        },
      },
    );

    watch.start();

    return () => watch.stop();
  }, [identityId]);

  // The erase starts once the workspace has unmounted, so nothing it tears
  // down writes back what the erase removed.
  useEffect(() => {
    if (deviceRemoval?.state !== 'erasing') return;

    const removedIdentityId = deviceRemoval.identityId;

    void eraseRemovedDevice(removedIdentityId, applicationContainer).then(
      (erased) => {
        setDeviceRemoval({
          identityId: removedIdentityId,
          state: erased ? 'erased' : 'erase-failed',
        });
      },
    );
  }, [deviceRemoval]);

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
    deviceRemoval,
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
