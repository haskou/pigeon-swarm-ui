import type {
  CallResource,
  CallResourceParticipant,
} from '../../../../contexts/calls/domain/callSession.types';
import type { Community } from '../../../../shared/domain/pigeonResources.types';

const keySeparator = '\u0000';

export function communityVoiceChannelTopologyKey(
  communities: Community[],
): string {
  return communities
    .map((community) =>
      [
        community.id,
        ...(community.voiceChannels ?? []).map((channel) => channel.id).sort(),
      ].join(keySeparator),
    )
    .sort()
    .join(`${keySeparator}${keySeparator}`);
}

export function communitiesWithCallVoicePresence(
  communities: Community[],
  calls: CallResource[],
): Community[] {
  const connectedIdentityIdsByChannel = connectedVoiceIdentities(calls);
  let changed = false;

  const nextCommunities = communities.map((community) => {
    const voiceChannels = community.voiceChannels;

    if (!voiceChannels) return community;

    let communityChanged = false;
    const nextVoiceChannels = voiceChannels.map((channel) => {
      const connectedIdentityIds =
        connectedIdentityIdsByChannel.get(
          voiceChannelKey(community.id, channel.id),
        ) ?? [];

      if (
        areIdentityListsEqual(
          channel.connectedIdentityIds ?? [],
          connectedIdentityIds,
        )
      ) {
        return channel;
      }

      communityChanged = true;

      return {
        ...channel,
        connectedIdentityIds,
      };
    });

    if (!communityChanged) return community;

    changed = true;

    return {
      ...community,
      voiceChannels: nextVoiceChannels,
    };
  });

  return changed ? nextCommunities : communities;
}

function connectedVoiceIdentities(calls: CallResource[]): Map<string, string[]> {
  const connectedIdentityIdsByChannel = new Map<string, string[]>();

  for (const call of calls) {
    if (call.status !== 'active') continue;
    if (call.scope.type !== 'community_channel') continue;

    const key = voiceChannelKey(call.scope.communityId, call.scope.channelId);
    const connectedIdentityIds = joinedParticipantIdentityIds(
      call.participants,
    );

    if (connectedIdentityIds.length > 0) {
      connectedIdentityIdsByChannel.set(
        key,
        [
          ...new Set([
            ...(connectedIdentityIdsByChannel.get(key) ?? []),
            ...connectedIdentityIds,
          ]),
        ],
      );
    }
  }

  return connectedIdentityIdsByChannel;
}

function joinedParticipantIdentityIds(
  participants: CallResourceParticipant[],
): string[] {
  return [
    ...new Set(
      participants
        .filter((participant) => participant.status === 'joined')
        .map((participant) => participant.identityId),
    ),
  ];
}

function voiceChannelKey(communityId: string, channelId: string): string {
  return `${communityId}${keySeparator}${channelId}`;
}

function areIdentityListsEqual(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((id, index) => id === right[index])
  );
}
