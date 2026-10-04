import { type MouseEvent, useCallback, useState } from 'react';

import type {
  ChatMessage,
  IdentityResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { ProfilePopoverAnchor } from '../../../identities/presentation/view-models/profilePopoverAnchor';
import type { CommunityProfileView } from './CommunityWorkspaceDialogs';

import { profileAnchorFromTarget } from '../../../identities/presentation/view-models/profilePopoverAnchor';

type UseCommunityProfileViewerInput = {
  memberIdentities: Record<string, IdentityResource>;
  memberPictures: Record<string, string>;
  session: Session;
};

type UseCommunityProfileViewerResult = {
  close: () => void;
  openIdentityProfile: (identityId: string, target: HTMLElement) => void;
  openMessageAuthorProfile: (
    message: ChatMessage,
    anchor?: ProfilePopoverAnchor,
  ) => void;
  openMemberProfile: (
    member: CommunityProfileView,
    anchor?: ProfilePopoverAnchor,
  ) => void;
  openVoiceParticipantProfile: (
    participant: { identityId: string; picture?: null | string },
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  profileViewer: CommunityProfileView | null;
};

export function useCommunityProfileViewer({
  memberIdentities,
  memberPictures,
  session,
}: UseCommunityProfileViewerInput): UseCommunityProfileViewerResult {
  const [profileViewer, setProfileViewer] =
    useState<CommunityProfileView | null>(null);
  const close = useCallback(() => setProfileViewer(null), []);
  const openMemberProfile = useCallback(
    (member: CommunityProfileView, anchor?: ProfilePopoverAnchor) =>
      setProfileViewer({ ...member, anchor }),
    [],
  );
  const openVoiceParticipantProfile = useCallback(
    (
      participant: {
        identityId: string;
        picture?: null | string;
      },
      event: MouseEvent<HTMLButtonElement>,
    ) =>
      openMemberProfile(
        {
          identity:
            participant.identityId === session.identity.id
              ? session.identity
              : memberIdentities[participant.identityId],
          identityId: participant.identityId,
          pictureUrl: participant.picture ?? null,
        },
        profileAnchorFromTarget(event.currentTarget),
      ),
    [memberIdentities, openMemberProfile, session.identity],
  );
  const openMessageAuthorProfile = (
    message: ChatMessage,
    anchor?: ProfilePopoverAnchor,
  ) => {
    const identityId = message.authorIdentityId;

    openMemberProfile(
      {
        identity:
          identityId === session.identity.id
            ? session.identity
            : memberIdentities[identityId],
        identityId,
        pictureUrl: memberPictures[identityId] ?? null,
      },
      anchor,
    );
  };
  const openIdentityProfile = (identityId: string, target: HTMLElement) =>
    openMemberProfile(
      {
        identity:
          identityId === session.identity.id
            ? session.identity
            : memberIdentities[identityId],
        identityId,
        pictureUrl: memberPictures[identityId] ?? null,
      },
      profileAnchorFromTarget(target),
    );

  return {
    close,
    openIdentityProfile,
    openMemberProfile,
    openMessageAuthorProfile,
    openVoiceParticipantProfile,
    profileViewer,
  };
}
