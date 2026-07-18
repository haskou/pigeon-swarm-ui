import type { MouseEvent } from 'react';

import { lazy, Suspense, useMemo, useState } from 'react';

import type { NodeNetwork } from '../../../../contexts/networks/presentation/view-models/NodeNetwork';
import type {
  ConversationResource,
  IdentityPresence,
  IdentityResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { memberPrimaryName } from '../../../../contexts/communities/presentation/components/communityMemberNames';
import { type IdentityMemberListItem } from '../../../../contexts/identities/presentation/components/IdentityMemberListPanel';
import {
  IdentityMembersAside,
  type IdentityMembersAsideVariant,
} from '../../../../contexts/identities/presentation/components/IdentityMembersAside';
import { profileAnchorFromTarget } from '../../../../contexts/identities/presentation/view-models/profilePopoverAnchor';

const UserProfileDialog = lazy(() =>
  import('../../../../contexts/identities/presentation/components/UserProfileDialog').then(
    (module) => ({
      default: module.UserProfileDialog,
    }),
  ),
);

interface InspectorProps {
  session: Session;
  activeConversation?: ConversationResource;
  activeConversationPeerIdentityId?: string;
  className?: string;
  identityNames: Record<string, string>;
  identityPictures: Record<string, string>;
  identityProfiles: Record<string, IdentityResource>;
  nodeNetworks: NodeNetwork[];
  onGroupInviteOpen?: () => void;
  onOpenConversationWithIdentity?: (
    identityId: string,
    identity?: IdentityResource,
    networkId?: string,
  ) => Promise<void>;
  presenceByIdentityId?: Record<string, IdentityPresence>;
  transitionState?: 'closing' | 'open';
  variant?: IdentityMembersAsideVariant;
}

export function Inspector({
  activeConversation,
  activeConversationPeerIdentityId,
  className,
  identityNames,
  identityPictures,
  identityProfiles,
  nodeNetworks,
  onGroupInviteOpen,
  onOpenConversationWithIdentity,
  presenceByIdentityId = {},
  session,
  transitionState = 'open',
  variant = 'desktop',
}: InspectorProps) {
  const [profileViewer, setProfileViewer] = useState<{
    anchor?: ReturnType<typeof profileAnchorFromTarget>;
    identity?: IdentityResource;
    identityId: string;
    name: string;
    picture?: null | string;
  } | null>(null);
  const isGroupConversation = isGroup(activeConversation);
  const participantIds = useMemo(
    () =>
      conversationParticipantIds({
        conversation: activeConversation,
        currentIdentityId: session.identity.id,
        peerIdentityId: activeConversationPeerIdentityId,
      }),
    [activeConversation, activeConversationPeerIdentityId, session.identity.id],
  );
  const participants = useMemo<IdentityMemberListItem[]>(
    () =>
      participantIds.map((identityId) => {
        const identity = identityProfiles[identityId];

        return {
          identity,
          identityId,
          name:
            identityNames[identityId] ??
            (identity ? memberPrimaryName(identity, identityId) : undefined),
          pictureUrl: identityPictures[identityId] ?? null,
          presence: presenceByIdentityId[identityId],
        };
      }),
    [
      identityNames,
      identityPictures,
      identityProfiles,
      participantIds,
      presenceByIdentityId,
    ],
  );
  const openProfile = (
    participant: IdentityMemberListItem,
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    setProfileViewer({
      anchor: profileAnchorFromTarget(event.currentTarget),
      identity: participant.identity,
      identityId: participant.identityId,
      name:
        participant.name ??
        memberPrimaryName(participant.identity, participant.identityId),
      picture: participant.pictureUrl,
    });
  };

  return (
    <>
      <IdentityMembersAside
        action={
          activeConversation && isGroupConversation && onGroupInviteOpen
            ? {
                label: copy.communities.addMember,
                onClick: onGroupInviteOpen,
              }
            : undefined
        }
        className={className}
        emptyLabel={activeConversation ? copy.communities.noMatchingMembers : ''}
        items={participants}
        onItemClick={openProfile}
        transitionState={transitionState}
        variant={variant}
      />

      {profileViewer && (
        <Suspense fallback={null}>
          <UserProfileDialog
            anchor={profileViewer.anchor}
            identity={profileViewer.identity}
            identityId={profileViewer.identityId}
            name={profileViewer.name}
            nodeNetworks={nodeNetworks}
            onClose={() => setProfileViewer(null)}
            onOpenConversation={
              profileViewer.identityId === session.identity.id ||
              !onOpenConversationWithIdentity
                ? undefined
                : () =>
                    onOpenConversationWithIdentity(
                      profileViewer.identityId,
                      profileViewer.identity,
                      activeConversation?.networkId,
                    )
            }
            picture={profileViewer.picture}
            presence={presenceByIdentityId[profileViewer.identityId]}
          />
        </Suspense>
      )}
    </>
  );
}

function conversationParticipantIds({
  conversation,
  currentIdentityId,
  peerIdentityId,
}: {
  conversation?: ConversationResource;
  currentIdentityId: string;
  peerIdentityId?: string;
}): string[] {
  if (!conversation) return [];

  const ids = isGroup(conversation)
    ? (conversation.participantIdentityIds ??
      conversation.participantIds ??
      conversation.participants ??
      [])
    : [currentIdentityId, peerIdentityId ?? conversation.peerIdentityId].filter(
        Boolean,
      );

  return [...new Set(ids)].filter(
    (identityId): identityId is string => typeof identityId === 'string',
  );
}

function isGroup(conversation?: ConversationResource): boolean {
  return Boolean(
    conversation &&
    (conversation.type === 'group' || conversation.id.startsWith('group:')),
  );
}
