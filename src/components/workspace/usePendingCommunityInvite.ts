import { type Dispatch, type SetStateAction, useEffect, useRef } from 'react';

import type { Community, Session } from '../../domain/types';
import type { PendingCommunityInviteLink } from '../../utils/communityInviteLink';

import { pigeonApplication } from '../../application/applicationContainer';
import { copy } from '../../i18n/en';
import { toUserErrorMessage } from '../../utils/toUserErrorMessage';

export function usePendingCommunityInvite({
  onPendingCommunityInviteHandled,
  pendingCommunityInvite,
  session,
  setActiveCommunityId,
  setCommunities,
  setSendError,
  setSession,
  setWorkspaceMode,
}: {
  onPendingCommunityInviteHandled?: () => void;
  pendingCommunityInvite?: PendingCommunityInviteLink | null;
  session: Session;
  setActiveCommunityId: (communityId: string) => void;
  setCommunities: Dispatch<SetStateAction<Community[]>>;
  setSendError: (error: string | null) => void;
  setSession: (session: Session | null) => void;
  setWorkspaceMode: (mode: 'community' | 'messages') => void;
}) {
  const pendingCommunityInviteRef = useRef<string | null>(null);
  const sessionRef = useRef(session);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (!pendingCommunityInvite) return;

    if (pendingCommunityInviteRef.current === pendingCommunityInvite.token) {
      return;
    }

    pendingCommunityInviteRef.current = pendingCommunityInvite.token;
    setSendError(null);
    void (async () => {
      if (!pendingCommunityInvite.keyEntry) {
        throw new Error(copy.communities.linkKeyMissing);
      }

      let nextSession = sessionRef.current;

      const accepted = await pigeonApplication.acceptCommunityInviteLinkWithKey(
        nextSession,
        pendingCommunityInvite.token,
        pendingCommunityInvite.keyEntry,
      );

      const acceptedCommunity = accepted.community;
      nextSession = {
        ...nextSession,
        keychain: accepted.keychain,
        keychainExternalIdentifier: accepted.keychainExternalIdentifier,
      };
      setSession(nextSession);

      setCommunities((current) => [
        acceptedCommunity,
        ...current.filter((community) => community.id !== acceptedCommunity.id),
      ]);
      setActiveCommunityId(acceptedCommunity.id);
      setWorkspaceMode('community');
      onPendingCommunityInviteHandled?.();
    })().catch((caught) => {
      pendingCommunityInviteRef.current = null;
      setSendError(toUserErrorMessage(caught, copy.communities.memberError));
    });
  }, [
    onPendingCommunityInviteHandled,
    pendingCommunityInvite,
    setActiveCommunityId,
    setCommunities,
    setSendError,
    setSession,
    setWorkspaceMode,
  ]);
}
