import type {
  CommunityRoleResource,
  IdentityResource,
} from '../../domain/types';

import { copy } from '../../i18n/en';
import { MemberRow } from './MemberRow';

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
  const banned = new Set(bannedMemberIds);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-white/35">
        {copy.communities.members}
      </div>
      <div className="space-y-3">
        {memberIds
          .filter((identityId) => !banned.has(identityId))
          .map((identityId) => (
            <div key={identityId} className="rounded-2xl bg-white/8 p-3">
              <MemberRow
                identity={memberIdentities[identityId]}
                identityId={identityId}
                onClick={() => undefined}
                owner={identityId === ownerIdentityId}
                pictureUrl={memberPictures[identityId] ?? null}
              />
              {canManageRoles && editableRoles.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {editableRoles.map((role) => (
                    <label
                      key={`${identityId}:${role.id}`}
                      className="flex items-center gap-2 rounded-xl bg-black/25 px-3 py-2 text-xs font-black text-white/70"
                    >
                      <input
                        type="checkbox"
                        checked={(memberRoleDrafts[identityId] ?? []).includes(
                          role.id,
                        )}
                        onChange={() => onToggleMemberRole(identityId, role.id)}
                      />
                      {role.name}
                    </label>
                  ))}
                  <button
                    type="button"
                    onClick={() => onSaveRoles(identityId)}
                    disabled={state === 'loading'}
                    className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {copy.communities.roleSave}
                  </button>
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
          ))}
      </div>
    </div>
  );
}
