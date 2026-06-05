import type { MouseEvent } from 'react';

import type {
  Community,
  IdentityPresence,
  IdentityResource,
} from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import {
  IdentityMemberListPanel,
  type IdentityMemberListItem,
} from '../../../identities/presentation/components/IdentityMemberListPanel';

export type CommunityMemberListItem = {
  identity?: IdentityResource;
  identityId: string;
  pictureUrl: null | string;
};

export function CommunityMembersPanel({
  canInvite,
  community,
  members,
  onAddMember,
  onCloseMobile,
  onMemberClick,
  openMobile,
  presenceByIdentityId,
}: {
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
  useCloseOnEscape(onCloseMobile, openMobile);

  return (
    <>
      <MembersAside
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
            className="fixed inset-0 z-40 bg-black/50 xl:hidden"
            onClick={onCloseMobile}
            aria-label={copy.dialog.close}
          />
          <MembersAside
            canInvite={canInvite}
            community={community}
            members={members}
            onAddMember={onAddMember}
            onMemberClick={onMemberClick}
            presenceByIdentityId={presenceByIdentityId}
            variant="mobile"
          />
        </>
      )}
    </>
  );
}

function MembersAside({
  canInvite,
  community,
  members,
  onAddMember,
  onMemberClick,
  presenceByIdentityId,
  variant,
}: {
  canInvite: boolean;
  community: Community;
  members: CommunityMemberListItem[];
  onAddMember: () => void;
  onMemberClick: (
    member: CommunityMemberListItem,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  presenceByIdentityId: Record<string, IdentityPresence>;
  variant: 'desktop' | 'mobile';
}) {
  const className =
    variant === 'desktop'
      ? 'glass-panel hidden h-full min-h-0 overflow-y-auto rounded-none p-4 xl:block'
      : 'app-safe-area-drawer-until-xl app-safe-area-drawer-py-4 glass-panel fixed inset-y-0 right-0 z-50 w-[86vw] max-w-[360px] overflow-y-auto rounded-none p-4 xl:hidden';

  return (
    <aside className={className}>
      <IdentityMemberListPanel
        action={
          canInvite
            ? {
                label: copy.communities.addMember,
                onClick: onAddMember,
              }
            : undefined
        }
        emptyLabel={copy.communities.noMatchingMembers}
        items={members.map((member) => ({
          ...member,
          owner: member.identityId === community.ownerIdentityId,
          presence: presenceByIdentityId[member.identityId],
        } satisfies IdentityMemberListItem))}
        onItemClick={onMemberClick}
        ownerLabel={copy.communities.owner}
      />
    </aside>
  );
}
