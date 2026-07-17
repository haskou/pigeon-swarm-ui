import { useCallback, useMemo } from 'react';

import type {
  Community,
  CommunityChannel,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/RealtimeGateway';

import { CommunityChannels } from '../../../../contexts/communities/presentation/view-models/CommunityChannels';
import {
  communityAttribute,
  communityChannelAttribute,
  eventAggregateId,
  stringAttribute,
} from './realtimeEventAttributes';

type WorkspaceRealtimeCommunityEventsInput = {
  onCommunitiesReload: () => Promise<void>;
  refreshMembershipRequests: () => Promise<void>;
  session: Session;
  setCommunities: (updater: (communities: Community[]) => Community[]) => void;
  updateCommunityState: (
    communityId: string,
    updater: (community: Community) => Community,
  ) => void;
};

function updateChannel(
  input: WorkspaceRealtimeCommunityEventsInput,
  event: RealtimeDomainEvent,
): boolean {
  const communityId =
    eventAggregateId(event) ?? stringAttribute(event, 'communityId');

  if (event.type === 'communities.v1.channel.was_created') {
    createChannel(input, communityId, event);

    return true;
  }

  if (event.type === 'communities.v1.channel.was_renamed') {
    renameCommunityChannel(input, communityId, event);

    return true;
  }

  if (event.type === 'communities.v1.channel.was_deleted') {
    deleteCommunityChannel(input, communityId, event);

    return true;
  }

  return false;
}

function createChannel(
  input: WorkspaceRealtimeCommunityEventsInput,
  communityId: string | undefined,
  event: RealtimeDomainEvent,
): void {
  const channel = communityChannelAttribute(event, 'channel');

  if (!communityId || !channel) return;

  input.updateCommunityState(communityId, (community) => {
    if (CommunityChannels.has(community, channel.id)) return community;

    return addChannel(community, channel);
  });
}

function renameCommunityChannel(
  input: WorkspaceRealtimeCommunityEventsInput,
  communityId: string | undefined,
  event: RealtimeDomainEvent,
): void {
  const channelId = stringAttribute(event, 'channelId');
  const name = stringAttribute(event, 'name');

  if (!communityId || !channelId || !name) return;

  input.updateCommunityState(communityId, (community) => ({
    ...community,
    textChannels: renameChannel(community.textChannels, channelId, name),
    voiceChannels: renameChannel(
      community.voiceChannels ?? [],
      channelId,
      name,
    ),
  }));
}

function deleteCommunityChannel(
  input: WorkspaceRealtimeCommunityEventsInput,
  communityId: string | undefined,
  event: RealtimeDomainEvent,
): void {
  const channelId = stringAttribute(event, 'channelId');

  if (!communityId || !channelId) return;

  input.updateCommunityState(communityId, (community) => ({
    ...community,
    textChannels: community.textChannels.filter(
      (channel) => channel.id !== channelId,
    ),
    voiceChannels: (community.voiceChannels ?? []).filter(
      (channel) => channel.id !== channelId,
    ),
  }));
}

function addChannel(
  community: Community,
  channel: CommunityChannel,
): Community {
  return channel.type === 'voice'
    ? {
        ...community,
        voiceChannels: [...(community.voiceChannels ?? []), channel],
      }
    : {
        ...community,
        textChannels: [...community.textChannels, channel],
      };
}

function renameChannel<T extends CommunityChannel>(
  channels: T[],
  channelId: string,
  name: string,
): T[] {
  return channels.map((channel) =>
    channel.id === channelId ? { ...channel, name } : channel,
  );
}

function updateMember(
  input: WorkspaceRealtimeCommunityEventsInput,
  event: RealtimeDomainEvent,
): boolean {
  const member = memberEventDetails(event);

  if (!member) return false;

  if (!member.communityId || !member.identityId) return true;

  if (isSelfLeavingMember(input, member.identityId, member.leaving)) {
    input.setCommunities((communities) =>
      communities.filter((item) => item.id !== member.communityId),
    );

    return true;
  }

  if (member.community && replaceCommunity(input, member.community)) {
    return true;
  }

  updateMemberIds(
    input,
    member.communityId,
    member.identityId,
    !member.leaving,
  );

  return true;
}

function isMemberEvent(event: RealtimeDomainEvent): boolean {
  return (
    event.type === 'communities.v1.member.was_added' ||
    event.type === 'communities.v1.member.was_left'
  );
}

type MemberEventDetails = {
  community?: Community;
  communityId?: string;
  identityId?: string;
  leaving: boolean;
};

function memberEventDetails(
  event: RealtimeDomainEvent,
): MemberEventDetails | undefined {
  if (!isMemberEvent(event)) return undefined;

  const community = communityAttribute(event, 'community');

  return {
    community,
    communityId:
      community?.id ??
      eventAggregateId(event) ??
      stringAttribute(event, 'communityId'),
    identityId: stringAttribute(event, 'identityId'),
    leaving: event.type === 'communities.v1.member.was_left',
  };
}

function isSelfLeavingMember(
  input: WorkspaceRealtimeCommunityEventsInput,
  identityId: string,
  leaving: boolean,
): boolean {
  return leaving && identityId === input.session.identity.id;
}

function replaceCommunity(
  input: WorkspaceRealtimeCommunityEventsInput,
  community: Community,
): boolean {
  input.setCommunities((communities) =>
    communities.map((item) => (item.id === community.id ? community : item)),
  );

  return true;
}

function updateMemberIds(
  input: WorkspaceRealtimeCommunityEventsInput,
  communityId: string,
  identityId: string,
  added: boolean,
): void {
  input.updateCommunityState(communityId, (current) => {
    if (added) {
      return current.memberIds.includes(identityId)
        ? current
        : { ...current, memberIds: [...current.memberIds, identityId] };
    }

    return {
      ...current,
      memberIds: current.memberIds.filter((id) => id !== identityId),
    };
  });
}

function handleMembershipRequest(
  input: WorkspaceRealtimeCommunityEventsInput,
  event: RealtimeDomainEvent,
): boolean {
  if (!event.type.startsWith('communities.v1.membership_request.')) {
    return false;
  }

  void input.refreshMembershipRequests();

  if (event.type === 'communities.v1.membership_request.was_accepted') {
    void input.onCommunitiesReload();
  }

  return true;
}

function updateCommunityResource(
  input: WorkspaceRealtimeCommunityEventsInput,
  event: RealtimeDomainEvent,
): boolean {
  if (event.type !== 'communities.v1.community.was_updated') return false;

  const community = communityAttribute(event, 'community');

  if (community) replaceCommunity(input, community);

  return true;
}

export function useWorkspaceRealtimeCommunityEvents(
  input: WorkspaceRealtimeCommunityEventsInput,
): (event: RealtimeDomainEvent) => boolean {
  const stableInput = useMemo(
    () => input,
    [
      input.onCommunitiesReload,
      input.refreshMembershipRequests,
      input.session,
      input.setCommunities,
      input.updateCommunityState,
    ],
  );

  return useCallback(
    (event: RealtimeDomainEvent): boolean => {
      if (event.type.startsWith('communities.v1.channel.message.')) {
        return false;
      }

      if (handleMembershipRequest(stableInput, event)) return true;

      if (updateChannel(stableInput, event)) return true;

      if (updateMember(stableInput, event)) return true;

      if (updateCommunityResource(stableInput, event)) return true;

      if (!event.type.startsWith('communities.')) return false;

      void stableInput.onCommunitiesReload();

      return true;
    },
    [stableInput],
  );
}
