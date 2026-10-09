import { type Dispatch, type SetStateAction, useEffect, useRef } from 'react';

import type { PendingCommunityInviteLink } from '../../../../contexts/communities/presentation/view-models/communityInviteLink';
import type {
  Community,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../composition/applicationContainer';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';

export function usePendingCommunityInvite({
  onPendingCommunityInviteHandled,
  pendingCommunityInvite,
  session,
  setActiveCommunityId,
  setCommunities,
  setSendError,
  setWorkspaceMode,
}: {
  onPendingCommunityInviteHandled?: () => void;
  pendingCommunityInvite?: PendingCommunityInviteLink | null;
  session: Session;
  setActiveCommunityId: (communityId: string) => void;
  setCommunities: Dispatch<SetStateAction<Community[]>>;
  setSendError: (error: string | null) => void;
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
      const acceptedCommunity =
        await applicationContainer.communities.acceptInviteLink(
          sessionRef.current,
          pendingCommunityInvite.token,
        );

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
      setWorkspaceMode,
  ]);
}
