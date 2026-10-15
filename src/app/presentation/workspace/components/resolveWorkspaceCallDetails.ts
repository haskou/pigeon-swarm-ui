import type { CallResource } from '../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { CallParticipant } from '../../../../contexts/calls/presentation/view-models/CallParticipant';
import type { CallSession } from '../../../../contexts/calls/presentation/view-models/CallSession';
import type { CommunityResource as Community } from '../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { IdentityResource } from '../../../../contexts/identities/infrastructure/http/resources/IdentityResource';
import type { LocalKeychain } from '../../../../contexts/identities/infrastructure/keychain/LocalKeychain';
import type {
  IdentityNames,
  IdentityPictures,
} from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import type { ResolveWorkspaceCallDetailsInput } from './ResolveWorkspaceCallDetailsInput';

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

function callParticipantIds(
  call: CallResource,
  currentIdentityId: string,
): string[] {
  if (call.scope.type === 'conversation') return call.participantIds;

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

function callParticipants({
  call,
  currentIdentity,
  identityNames,
  identityPictures,
  identityProfiles,
}: {
  call: CallResource;
  currentIdentity: IdentityResource;
  identityNames: IdentityNames;
  identityPictures: IdentityPictures;
  identityProfiles: Record<string, IdentityResource>;
}): CallParticipant[] {
  return callParticipantIds(call, currentIdentity.id).map((identityId) => {
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
}

function communityVoiceCallDetails({
  channelId,
  communities,
  communityId,
  fallbackLabels,
  participants,
}: {
  channelId: string;
  communities: Community[];
  communityId: string;
  fallbackLabels: ResolveWorkspaceCallDetailsInput['fallbackLabels'];
  participants: CallParticipant[];
}): WorkspaceCallDetails {
  const community = communities.find((item) => item.id === communityId);
  const channel = community
    ? CommunityChannels.find(community, channelId)
    : undefined;

  return {
    channelId,
    communityId,
    kind: 'community-voice',
    participants,
    subtitle: community?.name ?? fallbackLabels.privateCommunity,
    title: channel?.name ?? fallbackLabels.voiceChannel,
  };
}

function oneToOneCallTitle({
  fallbackLabel,
  identityNames,
  peerHandle,
  peerIdentity,
  peerIdentityId,
}: {
  fallbackLabel: string;
  identityNames: IdentityNames;
  peerHandle: string | undefined;
  peerIdentity: IdentityResource | undefined;
  peerIdentityId: string | undefined;
}): string {
  return (
    peerIdentity?.profile.name.trim() ||
    (peerHandle ? `@${peerHandle}` : undefined) ||
    (peerIdentityId ? identityNames[peerIdentityId] : undefined) ||
    fallbackLabel
  );
}

function oneToOneCallSubtitle(
  peerHandle: string | undefined,
  peerIdentityId: string | undefined,
): string | undefined {
  if (peerHandle) return `@${peerHandle}`;

  return peerIdentityId ? shortId(peerIdentityId) : undefined;
}

function conversationCallDetails({
  conversationId,
  conversations,
  currentIdentity,
  fallbackLabels,
  identityNames,
  identityProfiles,
  keychain,
  participants,
}: {
  conversationId: string;
  conversations: ConversationResource[];
  currentIdentity: IdentityResource;
  fallbackLabels: ResolveWorkspaceCallDetailsInput['fallbackLabels'];
  identityNames: IdentityNames;
  identityProfiles: Record<string, IdentityResource>;
  keychain: LocalKeychain;
  participants: CallParticipant[];
}): WorkspaceCallDetails {
  const conversation = conversations.find((item) => item.id === conversationId);
  const peerIdentityId = conversation
    ? ConversationPeer.identityId(conversation, currentIdentity.id, keychain)
    : undefined;
  const peerIdentity = peerIdentityId
    ? identityProfiles[peerIdentityId]
    : undefined;
  const peerHandle = peerIdentity?.profile.handle?.trim();

  return {
    conversationId,
    kind: 'one-to-one',
    participants,
    subtitle: oneToOneCallSubtitle(peerHandle, peerIdentityId),
    title: oneToOneCallTitle({
      fallbackLabel: fallbackLabels.noConversation,
      identityNames,
      peerHandle,
      peerIdentity,
      peerIdentityId,
    }),
  };
}

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
  const participants = callParticipants({
    call,
    currentIdentity,
    identityNames,
    identityPictures,
    identityProfiles,
  });
  const scope = call.scope;

  if (scope.type === 'group_capability') {
    return {
      kind: 'group',
      participants,
      subtitle: undefined,
      title: fallbackLabels.noConversation,
    };
  }

  if (scope.type === 'community_channel') {
    return communityVoiceCallDetails({
      channelId: scope.channelId,
      communities,
      communityId: scope.communityId,
      fallbackLabels,
      participants,
    });
  }

  return conversationCallDetails({
    conversationId: scope.conversationId,
    conversations,
    currentIdentity,
    fallbackLabels,
    identityNames,
    identityProfiles,
    keychain,
    participants,
  });
}
