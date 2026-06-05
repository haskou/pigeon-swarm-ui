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
import { SectionTitle } from '../../../../shared/presentation/components/SectionTitle';
import { MemberRow } from '../../../../modules/communities/presentation/components/MemberRow';
import { memberPrimaryName } from '../../../../modules/communities/presentation/components/communityMemberNames';
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
  const participants = useMemo(
    () =>
      participantIds.map((identityId) => {
        const identity = identityProfiles[identityId];

        return {
          identity,
          identityId,
          name:
            identityNames[identityId] ?? memberPrimaryName(identity, identityId),
          picture: identityPictures[identityId] ?? null,
        };
      }),
    [identityNames, identityPictures, identityProfiles, participantIds],
  );
  const openProfile = (
    participant: (typeof participants)[number],
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    setProfileViewer({
      anchor: profileAnchorFromTarget(event.currentTarget),
      identity: participant.identity,
      identityId: participant.identityId,
      name: participant.name,
      picture: participant.picture,
    });
  };

  return (
    <aside
      className={cx(
        'glass-panel inspector-panel flex flex-col rounded-none p-4',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SectionTitle title={copy.communities.members} />
          <span className="rounded-full bg-white/8 px-2.5 py-1 text-[0.68rem] font-black text-white/45">
            {participants.length}
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-xl font-black text-white/70 transition hover:bg-white/15 xl:hidden"
            aria-label={copy.dialog.close}
          >
            ×
          </button>
        )}
      </div>

      {isGroupConversation && onGroupInviteOpen && (
        <button
          type="button"
          onClick={onGroupInviteOpen}
          className="mt-4 w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15"
        >
          {copy.communities.addMember}
        </button>
      )}

      <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {participants.map((participant) => (
          <MemberRow
            key={participant.identityId}
            identity={participant.identity}
            identityId={participant.identityId}
            name={participant.name}
            onClick={(event) => openProfile(participant, event)}
            pictureUrl={participant.picture}
            presence={presenceByIdentityId[participant.identityId]}
            showBanner={false}
          />
        ))}
        {participants.length === 0 && (
          <div className="rounded-2xl bg-white/8 p-4 text-sm font-semibold text-white/45">
            {copy.communities.noMatchingMembers}
          </div>
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
