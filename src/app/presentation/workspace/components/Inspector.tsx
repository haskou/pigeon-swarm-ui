import type { MouseEvent } from 'react';

import { lazy, Suspense, useMemo, useState } from 'react';

import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { IdentityPresenceResource as IdentityPresence } from '../../../../contexts/identities/infrastructure/http/resources/IdentityPresenceResource';
import type { IdentityResource } from '../../../../contexts/identities/infrastructure/http/resources/IdentityResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { NodeNetwork } from '../../../../contexts/networks/presentation/view-models/NodeNetwork';

import { memberPrimaryName } from '../../../../contexts/communities/presentation/components/communityMemberNames';
import { type IdentityMemberListItem } from '../../../../contexts/identities/presentation/components/IdentityMemberListPanel';
import {
  IdentityMembersAside,
  type IdentityMembersAsideVariant,
} from '../../../../contexts/identities/presentation/components/IdentityMembersAside';
import { IdentityMatch } from '../../../../contexts/identities/presentation/view-models/IdentityMatch';
import { profileAnchorFromTarget } from '../../../../contexts/identities/presentation/view-models/profilePopoverAnchor';
import { copy } from '../../../../shared/presentation/i18n/copy';

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

function isGroup(conversation?: ConversationResource): boolean {
  return conversation?.type === 'group';
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
    ? conversation.participantIds
    : [currentIdentityId, peerIdentityId].filter(Boolean);

  return [...new Set(ids)].filter(
    (identityId): identityId is string => typeof identityId === 'string',
  );
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
        emptyLabel={
          activeConversation ? copy.communities.noMatchingMembers : ''
        }
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
              IdentityMatch.isSame(
                profileViewer.identityId,
                session.identity.id,
              ) || !onOpenConversationWithIdentity
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
