import type { CallParticipant } from '../../../../contexts/calls/presentation/view-models/CallParticipant';
import type { CallResource } from '../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { CallSession } from '../../../../contexts/calls/presentation/view-models/CallSession';
import type {
  Community,
  ConversationResource,
  IdentityResource,
  LocalKeychain,
} from '../../../../shared/domain/pigeonResources.types';
import type {
  IdentityNames,
  IdentityPictures,
} from '../../../../contexts/identities/presentation/view-models/identityDisplay';

import { CommunityChannels } from '../../../../contexts/communities/presentation/view-models/CommunityChannels';
import { ConversationPeer } from '../../../../contexts/conversations/presentation/view-models/ConversationPeer';
import { shortId } from '../../../../shared/presentation/formatting';

export type WorkspaceCallDetails = {
  channelId?: string;
  communityId?: string;
  conversationId?: string;
  kind: CallSession['kind'];
  participants: CallParticipant[];
  subtitle?: string;
  title: string;
};

type ResolveWorkspaceCallDetailsInput = {
  call: CallResource;
  communities: Community[];
  conversations: ConversationResource[];
  currentIdentity: IdentityResource;
  fallbackLabels: {
    noConversation: string;
    privateCommunity: string;
    voiceChannel: string;
  };
  identityNames: IdentityNames;
  identityPictures: IdentityPictures;
  identityProfiles: Record<string, IdentityResource>;
  keychain: LocalKeychain;
};

export function resolveWorkspaceCallDetails({
  call,
  communities,
  conversations,
  currentIdentity,
  fallbackLabels,
  identityNames,
  identityPictures,
  identityProfiles,
  keychain,
}: ResolveWorkspaceCallDetailsInput): WorkspaceCallDetails {
  const participantIds = callParticipantIds(call, currentIdentity.id);
  const participants = participantIds.map((identityId) => {
    const participant = callParticipantForIdentity({
      currentIdentity,
      identityId,
      identityNames,
      identityPictures,
      identityProfiles,
    });
    const status = call.participants.find(
      (item) => item.identityId === identityId,
    )?.status;

    return { ...participant, status };
  });
  const scope = call.scope;

  if (scope.type === 'community_channel') {
    const community = communities.find((item) => item.id === scope.communityId);
    const channel = community
      ? CommunityChannels.find(community, scope.channelId)
      : undefined;

    return {
      channelId: scope.channelId,
      communityId: scope.communityId,
      kind: 'community-voice',
      participants,
      subtitle: community?.name ?? fallbackLabels.privateCommunity,
      title: channel?.name ?? fallbackLabels.voiceChannel,
    };
  }

  const conversation = conversations.find(
    (item) => item.id === scope.conversationId,
  );
  const peerIdentityId = conversation
    ? ConversationPeer.identityId(conversation, currentIdentity.id, keychain)
    : undefined;
  const peerIdentity = peerIdentityId
    ? identityProfiles[peerIdentityId]
    : undefined;
  const peerHandle = peerIdentity?.profile.handle?.trim();
  const oneToOneTitle =
    peerIdentity?.profile.name.trim() ||
    (peerHandle ? `@${peerHandle}` : undefined) ||
    (peerIdentityId ? identityNames[peerIdentityId] : undefined) ||
    fallbackLabels.noConversation;
  const groupTitle =
    conversation?.name ?? conversation?.title ?? fallbackLabels.noConversation;
  const kind = conversation?.type === 'group' ? 'group' : 'one-to-one';

  return {
    conversationId: scope.conversationId,
    kind,
    participants,
    subtitle:
      kind === 'one-to-one'
        ? peerHandle
          ? `@${peerHandle}`
          : peerIdentityId
            ? shortId(peerIdentityId)
            : undefined
        : undefined,
    title: kind === 'one-to-one' ? oneToOneTitle : groupTitle,
  };
}

function callParticipantIds(
  call: CallResource,
  currentIdentityId: string,
): string[] {
  if (call.scope.type !== 'community_channel') return call.participantIds;

  return call.participants
    .filter(
      (participant) =>
        participant.connected || participant.identityId === currentIdentityId,
    )
    .map((participant) => participant.identityId);
}

function callParticipantForIdentity({
  currentIdentity,
  identityId,
  identityNames,
  identityPictures,
  identityProfiles,
}: {
  currentIdentity: IdentityResource;
  identityId: string;
  identityNames: IdentityNames;
  identityPictures: IdentityPictures;
  identityProfiles: Record<string, IdentityResource>;
}): CallParticipant {
  const identity =
    identityId === currentIdentity.id
      ? currentIdentity
      : identityProfiles[identityId];

  return {
    identity,
    identityId,
    muted: false,
    name:
      identityNames[identityId] ?? identity?.profile.name?.trim() ?? identityId,
    picture: identityPictures[identityId] ?? null,
  };
}
