import type { MouseEvent } from 'react';

import { lazy, Suspense, useMemo, useState } from 'react';

import type { NodeNetwork } from '../../../../modules/networks/application/list-node-networks/ListNodeNetworks';
import type {
  ConversationResource,
  IdentityPresence,
  IdentityResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import { memberPrimaryName } from '../../../../modules/communities/presentation/components/communityMemberNames';
import {
  IdentityMemberListPanel,
  type IdentityMemberListItem,
} from '../../../../modules/identities/presentation/components/IdentityMemberListPanel';
import { profileAnchorFromTarget } from '../../../../modules/identities/presentation/view-models/profilePopoverAnchor';

const UserProfileDialog = lazy(() =>
  import('../../../../modules/identities/presentation/components/UserProfileDialog').then(
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
  onClose?: () => void;
  onGroupInviteOpen?: () => void;
  onOpenConversationWithIdentity?: (
    identityId: string,
    identity?: IdentityResource,
    networkId?: string,
  ) => Promise<void>;
  presenceByIdentityId?: Record<string, IdentityPresence>;
}

export function Inspector({
  activeConversation,
  activeConversationPeerIdentityId,
  className,
  identityNames,
  identityPictures,
  identityProfiles,
  nodeNetworks,
  onClose,
  onGroupInviteOpen,
  onOpenConversationWithIdentity,
  presenceByIdentityId = {},
  session,
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
            identityNames[identityId] ?? memberPrimaryName(identity, identityId),
          pictureUrl: identityPictures[identityId] ?? null,
        };
      }),
    [identityNames, identityPictures, identityProfiles, participantIds],
  );
  const openProfile = (
    participant: IdentityMemberListItem,
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    setProfileViewer({
      anchor: profileAnchorFromTarget(event.currentTarget),
      identity: participant.identity,
      identityId: participant.identityId,
      name: participant.name ?? memberPrimaryName(participant.identity, participant.identityId),
      picture: participant.pictureUrl,
    });
  };

  return (
    <aside
      className={cx(
        'glass-panel inspector-panel flex flex-col rounded-none p-4',
        className,
      )}
    >
      <div className="flex min-h-0 flex-1 items-start justify-between gap-3">
        <IdentityMemberListPanel
          action={
            isGroupConversation && onGroupInviteOpen
              ? {
                  label: copy.communities.addMember,
                  onClick: onGroupInviteOpen,
                }
              : undefined
          }
          className="h-full min-h-0 flex-1"
          emptyLabel={copy.communities.noMatchingMembers}
          items={participants}
          onItemClick={openProfile}
        />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-xl font-black text-white/70 transition hover:bg-white/15 xl:hidden"
            aria-label={copy.dialog.close}
          >
            ×
          </button>
        )}
      </div>

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
    </aside>
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
  if (!conversation) return [currentIdentityId];

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
