import type {
  CommunityRoleResource,
  IdentityResource,
} from '../../../../shared/domain/pigeonResources.types';

import { useMemo, useState } from 'react';

import { communityRoleDisplayName } from '../view-models/communityRoleDisplayName';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import { ClearableSearchInput } from '../../../../shared/presentation/components/ClearableSearchInput';
import { IdentityMemberRow } from '../../../identities/presentation/components/IdentityMemberListPanel';
import { memberPrimaryName } from './communityMemberNames';

type PendingMemberAction = {
  action: 'ban' | 'kick';
  identityId: string;
} | null;

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
  onToggleMemberRole: (identityId: string, roleId: string) => void;
  ownerIdentityId: string;
  state: 'idle' | 'loading';
}) {
  const [memberSearch, setMemberSearch] = useState('');
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingMemberAction>(null);
  const visibleMemberIds = useMemo(() => {
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
  }, [bannedMemberIds, memberIdentities, memberIds, memberSearch]);

  return (
    <section className="ui-list-block">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-white/35">
          {copy.communities.members}
        </div>
        <ClearableSearchInput
          ariaLabel={copy.communities.searchMembers}
          className="min-w-0 sm:w-64"
          clearLabel={copy.communities.clearMemberSearch}
          onChange={setMemberSearch}
          placeholder={copy.communities.searchMembers}
          value={memberSearch}
        />
      </div>
      <div className="divide-y divide-white/10 border-y border-white/10">
        {visibleMemberIds.length === 0 ? (
          <div className="py-5 text-sm font-semibold text-white/45">
            {copy.communities.noMatchingMembers}
          </div>
        ) : (
          visibleMemberIds.map((identityId) => {
            const memberName = memberPrimaryName(
              memberIdentities[identityId],
              identityId,
            );
            const actionPendingForMember =
              pendingAction?.identityId === identityId;
            const expanded = expandedMemberId === identityId;
            const selectedRoleIds = memberRoleDrafts[identityId] ?? [];

            return (
              <div key={identityId} className="py-1">
                <div className="flex items-center gap-2 p-1.5">
                  <div className="min-w-0 flex-1">
                    <IdentityMemberRow
                      item={{
                        identity: memberIdentities[identityId],
                        identityId,
                        owner: identityId === ownerIdentityId,
                        pictureUrl: memberPictures[identityId] ?? null,
                      }}
                      onClick={() =>
                        setExpandedMemberId(expanded ? null : identityId)
                      }
                      ownerLabel={copy.communities.owner}
                    />
                  </div>
                  <MemberRoleSummary
                    roles={editableRoles}
                    selectedRoleIds={selectedRoleIds}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedMemberId(expanded ? null : identityId)
                    }
                    className="ui-icon-button h-9 w-9 shrink-0"
                    aria-expanded={expanded}
                    aria-label={memberName}
                  >
                    {expanded ? '−' : '+'}
                  </button>
                </div>
                {expanded && canManageRoles && editableRoles.length > 0 && (
                  <div className="mx-2 mb-2 border-t border-white/10 pt-3">
                    <div className="mb-2 text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/35">
                      {copy.communities.assignRoles}
                    </div>
                    <div className="divide-y divide-white/10 border-y border-white/10">
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
                            disabled={state === 'loading'}
                            className={cx(
                              'flex min-h-11 w-full items-center justify-between gap-3 px-2 py-2 text-left text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-45',
                              selected
                                ? 'text-cyan-50'
                                : 'text-white/65 hover:bg-white/[0.04] hover:text-white',
                            )}
                            aria-pressed={selected}
                          >
                            <span>{communityRoleDisplayName(role)}</span>
                            <span
                              aria-hidden="true"
                              className={cx(
                                'relative h-6 w-11 shrink-0 rounded-full border transition',
                                selected
                                  ? 'border-cyan-200/30 bg-cyan-400/55'
                                  : 'border-white/12 bg-white/10',
                              )}
                            >
                              <span
                                className={cx(
                                  'absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-sm transition',
                                  selected ? 'left-[1.3rem]' : 'left-0.5',
                                )}
                              />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {expanded && canManageRoles && editableRoles.length === 0 && (
                  <div className="mx-2 mb-2 border-t border-white/10 py-3 text-xs font-semibold text-white/45">
                    {copy.communities.noCustomRoles}
                  </div>
                )}
                {expanded && identityId !== ownerIdentityId && (
                  <div className="mx-2 mb-2 flex flex-wrap gap-2">
                    {canKickMembers && (
                      <button
                        type="button"
                        onClick={() =>
                          setPendingAction({ action: 'kick', identityId })
                        }
                        disabled={state === 'loading'}
                        className="ui-button disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {copy.communities.kickMember}
                      </button>
                    )}
                    {canBanMembers && (
                      <button
                        type="button"
                        onClick={() =>
                          setPendingAction({ action: 'ban', identityId })
                        }
                        disabled={state === 'loading'}
                        className="ui-button border-rose-300/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {copy.communities.banMember}
                      </button>
                    )}
                  </div>
                )}
                {pendingAction && actionPendingForMember && (
                  <div className="mx-2 mb-2 flex flex-col gap-2 rounded-2xl border border-rose-300/20 bg-rose-500/10 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0 text-xs font-bold text-rose-50/85">
                      {pendingAction.action === 'kick'
                        ? copy.communities.kickMember
                        : copy.communities.banMember}{' '}
                      {memberName}?
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const action = pendingAction;

                          setPendingAction(null);
                          if (action?.action === 'kick') onKick(identityId);
                          if (action?.action === 'ban') onBan(identityId);
                        }}
                        disabled={state === 'loading'}
                        className="rounded-xl bg-rose-100 px-3 py-2 text-xs font-black text-rose-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {pendingAction.action === 'kick'
                          ? copy.communities.confirmKickMember
                          : copy.communities.confirmBanMember}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingAction(null)}
                        className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white/15"
                      >
                        {copy.dialog.cancel}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function MemberRoleSummary({
  roles,
  selectedRoleIds,
}: {
  roles: CommunityRoleResource[];
  selectedRoleIds: string[];
}) {
  const selectedRoles = roles.filter((role) =>
    selectedRoleIds.includes(role.id),
  );

  if (selectedRoles.length === 0) {
    return (
      <span className="hidden text-[0.65rem] font-bold text-white/30 sm:inline-flex">
        {copy.communities.roles}
      </span>
    );
  }

  return (
    <span className="hidden max-w-48 truncate text-right text-[0.65rem] font-bold text-cyan-100/70 sm:block">
      {selectedRoles.map(communityRoleDisplayName).join(' · ')}
    </span>
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
