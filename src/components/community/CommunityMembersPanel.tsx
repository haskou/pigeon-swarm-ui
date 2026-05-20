import type { MouseEvent } from 'react';

import type {
  Community,
  IdentityPresence,
  IdentityResource,
} from '../../domain/types';

import { copy } from '../../i18n/en';
import { MemberRow } from './MemberRow';

export type CommunityMemberListItem = {
  identity?: IdentityResource;
  identityId: string;
  pictureUrl: null | string;
};

export function CommunityMembersPanel({
  community,
  members,
  onAddMember,
  onCloseMobile,
  onMemberClick,
  openMobile,
  presenceByIdentityId,
}: {
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
  return (
    <>
      <MembersAside
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
  community,
  members,
  onAddMember,
  onMemberClick,
  presenceByIdentityId,
  variant,
}: {
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
      : 'glass-panel fixed inset-y-0 right-0 z-50 w-[86vw] max-w-[360px] overflow-y-auto rounded-none p-4 xl:hidden';

  return (
    <aside className={className}>
      <button
        type="button"
        onClick={onAddMember}
        className="mb-4 w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15"
      >
        {copy.communities.addMember}
      </button>
      <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-white/35">
        {copy.communities.members}
      </div>
      <div className="space-y-2">
        {members.map((member) => (
          <MemberRow
            key={member.identityId}
            identity={member.identity}
            identityId={member.identityId}
            onClick={(event) => onMemberClick(member, event)}
            owner={member.identityId === community.ownerIdentityId}
            pictureUrl={member.pictureUrl}
            presence={presenceByIdentityId[member.identityId]}
          />
        ))}
      </div>
    </aside>
  );
}
