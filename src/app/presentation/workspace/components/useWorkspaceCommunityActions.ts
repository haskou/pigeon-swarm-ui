import {
  useCallback,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';

import type {
  Community,
  CommunityChannel,
  CommunityMembershipRequest,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { CommunityChannels } from '../../../../contexts/communities/presentation/view-models/CommunityChannels';
import { CommunityList } from '../../../../contexts/communities/presentation/view-models/CommunityList';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { applicationContainer } from '../../../composition/applicationContainer';

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
  setSession: (session: Session) => void;
  showCommunityWorkspace: () => void;
  showMessagesWorkspace: () => void;
};

type WorkspaceCommunityActions = {
  create: (input: { community: Community; session: Session }) => void;
  joinRequested: (request: CommunityMembershipRequest) => void;
  leave: (community: Community) => Promise<void>;
  remove: (community: Community) => void;
  update: (community: Community) => void;
  updateChannels: (communityId: string, channels: CommunityChannel[]) => void;
  updateState: (
    communityId: string,
    updater: (community: Community) => Community,
  ) => void;
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
      setSession(nextSession);
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
      setMembershipRequests((current) => [
        request,
        ...current.filter((item) => item.id !== request.id),
      ]);

      if (request.status === 'accepted') {
        void applicationContainer.communities
          .get(sessionRef.current, request.communityId)
          .then((community) => {
            setCommunities((current) =>
              CommunityList.prepending(current, community),
            );
            setActiveCommunityId(community.id);
            showCommunityWorkspace();
          })
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

        setSession({
          ...session,
          keychain: result.keychain,
          keychainExternalIdentifier: result.keychainExternalIdentifier,
        });
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
