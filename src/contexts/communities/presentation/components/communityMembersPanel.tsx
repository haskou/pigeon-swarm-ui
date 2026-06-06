import type { MouseEvent } from 'react';

import type {
  Community,
  IdentityPresence,
  IdentityResource,
} from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import {
  type IdentityMemberListItem,
} from '../../../identities/presentation/components/IdentityMemberListPanel';
import { IdentityMembersAside } from '../../../identities/presentation/components/IdentityMembersAside';

export type CommunityMemberListItem = {
  identity?: IdentityResource;
  identityId: string;
  pictureUrl: null | string;
};

export function CommunityMembersPanel({
  animateEntries = true,
  animationScopeKey,
  canInvite,
  community,
  members,
  onAddMember,
  onCloseMobile,
  onMemberClick,
  openMobile,
  presenceByIdentityId,
}: {
  animateEntries?: boolean;
  animationScopeKey?: string;
  canInvite: boolean;
  community: Community;
  members: CommunityMemberListItem[];
  onAddMember: () => void;
  onCloseMobile: () => void;
  onMemberClick: (
    member: CommunityMemberListItem,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  openMobile: boolean;
  presenceByIdentityId: Record<string, IdentityPresence>;
}) {
  const { close, state } = useCloseTransition(onCloseMobile);

  useCloseOnEscape(close, openMobile);

  return (
    <>
      <MembersAside
        animateEntries={animateEntries}
        animationScopeKey={animationScopeKey}
        canInvite={canInvite}
        community={community}
        members={members}
        onAddMember={onAddMember}
        onMemberClick={onMemberClick}
        presenceByIdentityId={presenceByIdentityId}
        variant="desktop"
      />
      {openMobile && (
        <>
          <button
            className="app-overlay-scrim fixed inset-0 z-40 bg-black/50 xl:hidden"
            data-state={state}
            onClick={close}
            aria-label={copy.dialog.close}
          />
          <MembersAside
            animateEntries={animateEntries}
            animationScopeKey={animationScopeKey}
            canInvite={canInvite}
            community={community}
            members={members}
            onAddMember={onAddMember}
            onMemberClick={onMemberClick}
            presenceByIdentityId={presenceByIdentityId}
            transitionState={state}
            variant="mobile"
          />
        </>
      )}
    </>
  );
}

function MembersAside({
  animateEntries,
  animationScopeKey,
  canInvite,
  community,
  members,
  onAddMember,
  onMemberClick,
  presenceByIdentityId,
  transitionState = 'open',
  variant,
}: {
  animateEntries: boolean;
  animationScopeKey?: string;
  canInvite: boolean;
  community: Community;
  members: CommunityMemberListItem[];
  onAddMember: () => void;
  onMemberClick: (
    member: CommunityMemberListItem,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  presenceByIdentityId: Record<string, IdentityPresence>;
  transitionState?: 'closing' | 'open';
  variant: 'desktop' | 'mobile';
}) {
  return (
    <IdentityMembersAside
      action={
        canInvite
          ? {
              label: copy.communities.addMember,
              onClick: onAddMember,
            }
          : undefined
      }
      animateEntries={animateEntries}
      animationScopeKey={animationScopeKey}
      emptyLabel={copy.communities.noMatchingMembers}
      items={members.map((member) => ({
        ...member,
        owner: member.identityId === community.ownerIdentityId,
        presence: presenceByIdentityId[member.identityId],
      } satisfies IdentityMemberListItem))}
      onItemClick={onMemberClick}
      ownerLabel={copy.communities.owner}
      transitionState={transitionState}
      variant={variant}
    />
  );
}
