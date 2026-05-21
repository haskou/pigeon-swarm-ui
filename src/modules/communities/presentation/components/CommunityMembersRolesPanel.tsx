import type {
  CommunityRoleResource,
  IdentityResource,
} from '../../../../shared/domain/pigeonResources.types';

import { useMemo, useState } from 'react';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { MemberRow } from './MemberRow';
import { memberPrimaryName } from './communityMemberNames';

export function CommunityMembersRolesPanel({
  bannedMemberIds,
  canBanMembers,
  canKickMembers,
  canManageRoles,
  editableRoles,
  memberIdentities,
  memberIds,
  memberPictures,
  memberRoleDrafts,
  onBan,
  onKick,
  onSaveRoles,
  onToggleMemberRole,
  ownerIdentityId,
  state,
}: {
  bannedMemberIds: string[];
  canBanMembers: boolean;
  canKickMembers: boolean;
  canManageRoles: boolean;
  editableRoles: CommunityRoleResource[];
  memberIdentities: Record<string, IdentityResource>;
  memberIds: string[];
  memberPictures: Record<string, string>;
  memberRoleDrafts: Record<string, string[]>;
  onBan: (identityId: string) => void;
  onKick: (identityId: string) => void;
  onSaveRoles: (identityId: string) => void;
  onToggleMemberRole: (identityId: string, roleId: string) => void;
  ownerIdentityId: string;
  state: 'idle' | 'loading';
}) {
  const [memberSearch, setMemberSearch] = useState('');
  const visibleMemberIds = useMemo(
    () => {
      const banned = new Set(bannedMemberIds);

      return memberIds
        .filter((identityId) => !banned.has(identityId))
        .filter((identityId) =>
          matchesMemberSearch(
            identityId,
            memberIdentities[identityId],
            memberSearch,
          ),
        );
    },
    [bannedMemberIds, memberIdentities, memberIds, memberSearch],
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-white/35">
          {copy.communities.members}
        </div>
        <input
          type="search"
          value={memberSearch}
          onChange={(event) => setMemberSearch(event.target.value)}
          className="min-w-0 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60 sm:w-64"
          placeholder={copy.communities.searchMembers}
          aria-label={copy.communities.searchMembers}
        />
      </div>
      <div className="space-y-3">
        {visibleMemberIds.length === 0 ? (
          <div className="rounded-2xl bg-white/8 p-4 text-sm font-semibold text-white/45">
            {copy.communities.noMatchingMembers}
          </div>
        ) : (
          visibleMemberIds.map((identityId) => (
            <div key={identityId} className="rounded-2xl bg-white/8 p-3">
              <MemberRow
                identity={memberIdentities[identityId]}
                identityId={identityId}
                onClick={() => undefined}
                owner={identityId === ownerIdentityId}
                pictureUrl={memberPictures[identityId] ?? null}
              />
              {canManageRoles && editableRoles.length > 0 && (
                <div className="mt-3 rounded-2xl bg-black/20 p-3">
                  <div className="mb-2 text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/35">
                    {copy.communities.assignRoles}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {editableRoles.map((role) => {
                      const selected = (
                        memberRoleDrafts[identityId] ?? []
                      ).includes(role.id);

                      return (
                        <button
                          key={`${identityId}:${role.id}`}
                          type="button"
                          onClick={() =>
                            onToggleMemberRole(identityId, role.id)
                          }
                          className={
                            selected
                              ? 'rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-950 transition'
                              : 'rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white/65 transition hover:bg-white/15 hover:text-white'
                          }
                          aria-pressed={selected}
                        >
                          {role.name}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => onSaveRoles(identityId)}
                      disabled={state === 'loading'}
                      className="rounded-xl bg-fuchsia-400 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {copy.communities.saveMemberRoles}
                    </button>
                  </div>
                </div>
              )}
              {canManageRoles && editableRoles.length === 0 && (
                <div className="mt-3 rounded-2xl bg-black/20 p-3 text-xs font-semibold text-white/45">
                  {copy.communities.noCustomRoles}
                </div>
              )}
              {identityId !== ownerIdentityId && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {canKickMembers && (
                    <button
                      type="button"
                      onClick={() => onKick(identityId)}
                      disabled={state === 'loading'}
                      className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {copy.communities.kickMember}
                    </button>
                  )}
                  {canBanMembers && (
                    <button
                      type="button"
                      onClick={() => onBan(identityId)}
                      disabled={state === 'loading'}
                      className="rounded-xl bg-rose-500/15 px-3 py-2 text-xs font-black text-rose-100 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {copy.communities.banMember}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function matchesMemberSearch(
  identityId: string,
  identity: IdentityResource | undefined,
  search: string,
): boolean {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) return true;

  const handle = identity?.profile.handle?.trim() ?? '';
  const visibleHandle = handle
    ? handle.startsWith('@')
      ? handle
      : `@${handle}`
    : '';
  const name = memberPrimaryName(identity, identityId);

  return [identityId, handle, visibleHandle, name].some((value) =>
    value.toLowerCase().includes(normalizedSearch),
  );
}
