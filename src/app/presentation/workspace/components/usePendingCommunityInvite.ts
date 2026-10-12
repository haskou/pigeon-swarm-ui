import { type Dispatch, type SetStateAction, useEffect, useRef } from 'react';

import type { CommunityResource as Community } from '../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { PendingCommunityInviteLink } from '../../../../contexts/communities/presentation/view-models/communityInviteLink';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { applicationContainer } from '../../../composition/applicationContainer';

function prependCommunity(
  communities: Community[],
  community: Community,
): Community[] {
  return [
    community,
    ...communities.filter((current) => current.id !== community.id),
  ];
}

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
}): void {
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
    const acceptInvite = async (): Promise<void> => {
      const acceptedCommunity =
        await applicationContainer.communities.acceptInviteLink(
          sessionRef.current,
          pendingCommunityInvite.token,
        );

      setCommunities((current) => prependCommunity(current, acceptedCommunity));
      setActiveCommunityId(acceptedCommunity.id);
      setWorkspaceMode('community');
      onPendingCommunityInviteHandled?.();
    };

    void acceptInvite().catch((caught) => {
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
