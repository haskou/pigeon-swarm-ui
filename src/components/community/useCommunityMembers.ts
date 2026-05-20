import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  CallParticipant,
  CallSession,
} from '../../domain/calls/CallSession';
import type {
  Community,
  CommunityChannel,
  CommunityVoiceChannel,
  IdentityResource,
  Session,
} from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';
import { identityName } from '../../utils/identityDisplay';
import { shortId } from '../../utils/formatting';
import { normalizeIdentityId } from '../../utils/identityId';
import { loadIdentityPicture } from './communityImages';
import type { CommunityMemberListItem } from './CommunityMembersPanel';
import { memberDisplayName } from './communityMemberNames';

export function useCommunityMembers({
  activeCall,
  activeVoiceChannelId,
  community,
  session,
  visibleVoiceChannels,
  voiceChannels,
}: {
  activeCall?: CallSession | null;
  activeVoiceChannelId: null | string;
  community: Community;
  session: Session;
  visibleVoiceChannels: CommunityVoiceChannel[];
  voiceChannels: CommunityVoiceChannel[];
}) {
  const [memberIdentities, setMemberIdentities] = useState<
    Record<string, IdentityResource>
  >({});
  const [memberPictures, setMemberPictures] = useState<Record<string, string>>(
    {},
  );
  const communityMemberIdsKey = useMemo(
    () => community.memberIds.join('\u0000'),
    [community.memberIds],
  );
  const communityMemberIds = useMemo(
    () =>
      communityMemberIdsKey.length > 0
        ? communityMemberIdsKey.split('\u0000')
        : [],
    [communityMemberIdsKey],
  );
  const voiceConnectedIdentityIds = useMemo(
    () =>
      voiceChannels.flatMap((channel) => channel.connectedIdentityIds ?? []),
    [voiceChannels],
  );
  const identityIdsToLoad = useMemo(
    () =>
      Array.from(
        new Set([...communityMemberIds, ...voiceConnectedIdentityIds]),
      ),
    [communityMemberIds, voiceConnectedIdentityIds],
  );

  useEffect(() => {
    let cancelled = false;

    void Promise.all(
      identityIdsToLoad.map(async (identityId) => {
        try {
          const identity =
            identityId === session.identity.id
              ? session.identity
              : await pigeonApplication.getIdentity(
                  normalizeIdentityId(identityId),
                );
          const pictureUrl = await loadIdentityPicture(identity);

          return [identityId, identity, pictureUrl] as const;
        } catch {
          return [identityId, undefined, null] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;

      const nextIdentities: Record<string, IdentityResource> = {};
      const nextPictures: Record<string, string> = {};

      for (const [identityId, identity, pictureUrl] of entries) {
        if (identity) nextIdentities[identityId] = identity;

        if (pictureUrl) nextPictures[identityId] = pictureUrl;
      }

      setMemberIdentities(nextIdentities);
      setMemberPictures(nextPictures);
    });

    return () => {
      cancelled = true;
    };
  }, [identityIdsToLoad, session.identity]);

  const members = useMemo<CommunityMemberListItem[]>(
    () =>
      community.memberIds.map((identityId) => ({
        identity: memberIdentities[identityId],
        identityId,
        pictureUrl: memberPictures[identityId] ?? null,
      })),
    [community.memberIds, memberIdentities, memberPictures],
  );
  const ownIdentityPictures = useMemo(
    () =>
      memberPictures[session.identity.id]
        ? { [session.identity.id]: memberPictures[session.identity.id] }
        : {},
    [memberPictures, session.identity.id],
  );
  const reactionAuthorNames = useMemo(
    () =>
      Object.fromEntries(
        community.memberIds.map((identityId) => [
          identityId,
          memberDisplayName(memberIdentities[identityId], identityId),
        ]),
      ),
    [community.memberIds, memberIdentities],
  );
  const callParticipantForIdentity = useCallback(
    (identityId: string): CallParticipant => {
      const identity =
        identityId === session.identity.id
          ? session.identity
          : memberIdentities[identityId];

      return {
        identity,
        identityId,
        deafened: false,
        muted: false,
        name: identity
          ? (identityName(identity) ?? shortId(identityId))
          : shortId(identityId),
        picture: memberPictures[identityId] ?? null,
      };
    },
    [memberIdentities, memberPictures, session.identity],
  );
  const voiceParticipantViewForIdentity = useCallback(
    (
      identityId: string,
      activeParticipant?: CallParticipant,
    ): CallParticipant => {
      const fallbackParticipant = callParticipantForIdentity(identityId);

      if (!activeParticipant) return fallbackParticipant;

      return {
        ...activeParticipant,
        identity: activeParticipant.identity ?? fallbackParticipant.identity,
        name:
          activeParticipant.name?.trim() &&
          activeParticipant.name !== shortId(identityId)
            ? activeParticipant.name
            : fallbackParticipant.name,
        picture: activeParticipant.picture ?? fallbackParticipant.picture,
      };
    },
    [callParticipantForIdentity],
  );
  const voiceParticipantsForChannel = useCallback(
    (channel: CommunityChannel): CallParticipant[] => {
      if (channel.type !== 'voice') return [];

      const activeParticipants =
        activeVoiceChannelId === channel.id
          ? (activeCall?.participants ?? [])
          : [];
      const activeByIdentityId = new Map(
        activeParticipants.map((participant) => [
          participant.identityId,
          participant,
        ]),
      );
      const identityIds = Array.from(
        new Set([
          ...(channel.connectedIdentityIds ?? []),
          ...activeParticipants.map((participant) => participant.identityId),
        ]),
      );

      return identityIds.map((identityId) =>
        voiceParticipantViewForIdentity(
          identityId,
          activeByIdentityId.get(identityId),
        ),
      );
    },
    [
      activeCall?.participants,
      activeVoiceChannelId,
      voiceParticipantViewForIdentity,
    ],
  );
  const voiceParticipantsByChannelId = useMemo(
    () =>
      new Map(
        visibleVoiceChannels.map((channel) => [
          channel.id,
          voiceParticipantsForChannel(channel),
        ]),
      ),
    [visibleVoiceChannels, voiceParticipantsForChannel],
  );

  return {
    communityMemberIds,
    memberIdentities,
    memberPictures,
    members,
    ownIdentityPictures,
    reactionAuthorNames,
    voiceParticipantsByChannelId,
  };
}
