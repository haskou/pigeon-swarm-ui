import {
  useCallback,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';

import type { CommunityChannelResource as CommunityChannel } from '../../../../contexts/communities/infrastructure/http/resources/CommunityChannelResource';
import type { CommunityMembershipRequestResource as CommunityMembershipRequest } from '../../../../contexts/communities/infrastructure/http/resources/CommunityMembershipRequestResource';
import type { CommunityResource as Community } from '../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { WorkspaceCommunityActions } from './WorkspaceCommunityActions';

import { CommunityChannels } from '../../../../contexts/communities/presentation/view-models/CommunityChannels';
import { CommunityList } from '../../../../contexts/communities/presentation/view-models/CommunityList';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { applicationContainer } from '../../../composition/applicationContainer';
import { applyPublishedKeychain } from './applyPublishedKeychain';

function prependMembershipRequest(
  requests: CommunityMembershipRequest[],
  request: CommunityMembershipRequest,
): CommunityMembershipRequest[] {
  return [request, ...requests.filter((item) => item.id !== request.id)];
}

type WorkspaceCommunityActionsInput = {
  activeCommunityId: null | string;
  closeCommunityCreation: () => void;
  closeSidebar: () => void;
  session: Session;
  sessionRef: RefObject<Session>;
  setActiveCommunityId: (communityId: null | string) => void;
  setCommunities: Dispatch<SetStateAction<Community[]>>;
  setMembershipRequests: Dispatch<SetStateAction<CommunityMembershipRequest[]>>;
  setSendError: (error: null | string) => void;
  setSession: Dispatch<SetStateAction<Session | null>>;
  showCommunityWorkspace: () => void;
  showMessagesWorkspace: () => void;
};

export function useWorkspaceCommunityActions({
  activeCommunityId,
  closeCommunityCreation,
  closeSidebar,
  session,
  sessionRef,
  setActiveCommunityId,
  setCommunities,
  setMembershipRequests,
  setSendError,
  setSession,
  showCommunityWorkspace,
  showMessagesWorkspace,
}: WorkspaceCommunityActionsInput): WorkspaceCommunityActions {
  const updateState = useCallback(
    (communityId: string, updater: (community: Community) => Community) => {
      setCommunities((current) =>
        CommunityList.updating(current, communityId, updater),
      );
    },
    [setCommunities],
  );

  const updateChannels = useCallback(
    (communityId: string, channels: CommunityChannel[]): void => {
      const splitChannels = CommunityChannels.split(channels);

      updateState(communityId, (community) => ({
        ...community,
        ...splitChannels,
      }));
    },
    [updateState],
  );

  const create = useCallback(
    ({
      community,
      session: nextSession,
    }: {
      community: Community;
      session: Session;
    }): void => {
      setSession((current) =>
        applyPublishedKeychain(current, nextSession.identity.id, nextSession),
      );
      setCommunities((current) => CommunityList.prepending(current, community));
      setActiveCommunityId(community.id);
      showCommunityWorkspace();
      closeCommunityCreation();
    },
    [
      closeCommunityCreation,
      setActiveCommunityId,
      setCommunities,
      setSession,
      showCommunityWorkspace,
    ],
  );

  const joinRequested = useCallback(
    (request: CommunityMembershipRequest): void => {
      setMembershipRequests((current) =>
        prependMembershipRequest(current, request),
      );

      if (request.status === 'accepted') {
        const showJoinedCommunity = (community: Community): void => {
          setCommunities((current) =>
            CommunityList.prepending(current, community),
          );
          setActiveCommunityId(community.id);
          showCommunityWorkspace();
        };

        void applicationContainer.communities
          .get(sessionRef.current, request.communityId)
          .then(showJoinedCommunity)
          .catch((caught) =>
            setSendError(
              toUserErrorMessage(caught, copy.communities.membershipError),
            ),
          );
      }

      closeCommunityCreation();
    },
    [
      closeCommunityCreation,
      sessionRef,
      setActiveCommunityId,
      setCommunities,
      setMembershipRequests,
      setSendError,
      showCommunityWorkspace,
    ],
  );

  const leave = useCallback(
    async (community: Community): Promise<void> => {
      if (!window.confirm(copy.communities.leaveConfirm)) return;

      try {
        const result = await applicationContainer.communities.leave(
          session,
          community.id,
        );
        const removedCommunityId = result.community?.id ?? community.id;

        setSession((current) =>
          applyPublishedKeychain(current, session.identity.id, result),
        );
        setCommunities((current) =>
          CommunityList.without(current, removedCommunityId),
        );

        if (activeCommunityId === removedCommunityId) {
          setActiveCommunityId(null);
          showMessagesWorkspace();
          closeSidebar();
        }
      } catch (caught) {
        setSendError(toUserErrorMessage(caught, copy.communities.leaveError));
      }
    },
    [
      activeCommunityId,
      closeSidebar,
      session,
      setActiveCommunityId,
      setCommunities,
      setSendError,
      setSession,
      showMessagesWorkspace,
    ],
  );

  const update = useCallback(
    (community: Community): void => {
      updateState(community.id, (current) =>
        CommunityList.preservingCommunityVoicePresence(community, current),
      );
    },
    [updateState],
  );

  const remove = useCallback(
    (community: Community): void => {
      setCommunities((current) => CommunityList.without(current, community.id));
    },
    [setCommunities],
  );

  return {
    create,
    joinRequested,
    leave,
    remove,
    update,
    updateChannels,
    updateState,
  };
}
