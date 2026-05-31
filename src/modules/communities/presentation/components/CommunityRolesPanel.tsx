import type {
  CommunityPermission,
  CommunityRoleResource,
} from '../../../../shared/domain/pigeonResources.types';

import { useState } from 'react';

import { communityRoleDisplayName } from '../view-models/communityRoleDisplayName';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';

export function CommunityRolesPanel({
  editableRoles,
  onCreateRole,
  onDeleteRole,
  onRoleNameChange,
  onRolePermissionToggle,
  onRoleSelect,
  onUpdateRole,
  roleName,
  rolePermissions,
  roleMemberCounts,
  roles,
  selectedRole,
  state,
}: {
  editableRoles: CommunityRoleResource[];
  onCreateRole: () => void;
  onDeleteRole: (role: CommunityRoleResource) => void;
  onRoleNameChange: (value: string) => void;
  onRolePermissionToggle: (permission: CommunityPermission) => void;
  onRoleSelect: (roleId: string) => void;
  onUpdateRole: () => void;
  roleName: string;
  rolePermissions: CommunityPermission[];
  roleMemberCounts: Record<string, number>;
  roles: CommunityRoleResource[];
  selectedRole: CommunityRoleResource | null;
  state: 'idle' | 'loading';
}) {
  const [pendingDeleteRoleId, setPendingDeleteRoleId] = useState<
    string | null
  >(null);
  const selectedRoleIsBuiltIn = selectedRole?.builtIn ?? false;
  const displayedRoleName =
    selectedRoleIsBuiltIn && selectedRole
      ? communityRoleDisplayName(selectedRole)
      : roleName;
  const selectedRoleMemberCount = selectedRole
    ? (roleMemberCounts[selectedRole.id] ?? 0)
    : 0;

  return (
    <div className="grid min-h-0 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="flex min-h-0 flex-col rounded-2xl border border-white/10 bg-black/20 p-3">
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => onRoleSelect(role.id)}
              className={cx(
                'block w-full rounded-2xl px-3 py-2 text-left text-sm font-black transition',
                selectedRole?.id === role.id
                  ? 'bg-[#c8c0d8]/85 text-[#171426] shadow-inner shadow-white/10'
                  : 'bg-white/8 text-white/75 hover:bg-white/12',
              )}
            >
              {communityRoleDisplayName(role)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            onRoleSelect('');
            onRoleNameChange('');
          }}
          className="mt-3 w-full shrink-0 rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-950"
        >
          + {copy.communities.role}
        </button>
      </div>
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <input
          value={displayedRoleName}
          onChange={(event) => {
            if (selectedRoleIsBuiltIn) return;

            onRoleNameChange(event.target.value);
          }}
          readOnly={selectedRoleIsBuiltIn}
          className={cx(
            'mb-4 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-lg font-black text-white outline-none focus:border-cyan-300/60',
            selectedRoleIsBuiltIn && 'cursor-default',
          )}
          placeholder={copy.communities.roleName}
        />
        <div className="grid gap-3">
          {PERMISSION_GROUPS.map((group) => (
            <section
              key={group.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-3"
            >
              <div className="mb-2 text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/35">
                {permissionGroupLabel(group.id)}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.permissions.map((permission) => (
                  <PermissionToggle
                    key={permission}
                    onToggle={() => onRolePermissionToggle(permission)}
                    permission={permission}
                    selected={rolePermissions.includes(permission)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={selectedRole ? onUpdateRole : onCreateRole}
            disabled={
              selectedRoleIsBuiltIn || !roleName.trim() || state === 'loading'
            }
            className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {state === 'loading'
              ? copy.profile.saving
              : selectedRole
                ? copy.communities.roleSave
                : copy.communities.createRole}
          </button>
          {selectedRole && !selectedRole.builtIn && (
            <button
              type="button"
              onClick={() => setPendingDeleteRoleId(selectedRole.id)}
              disabled={state === 'loading'}
              className="rounded-2xl bg-rose-500/15 px-4 py-2 text-sm font-black text-rose-100 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {copy.messages.delete}
            </button>
          )}
          {editableRoles.length === 0 && (
            <span className="py-2 text-xs text-white/45">
              {copy.communities.noCustomRoles}
            </span>
          )}
        </div>
        {selectedRole && pendingDeleteRoleId === selectedRole.id && (
          <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 p-3">
            <div className="text-xs font-bold text-rose-50/85">
              {copy.communities.roleDeleteConfirm}
            </div>
            {selectedRoleMemberCount > 0 && (
              <div className="mt-2 rounded-xl bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-100">
                {copy.communities.roleDeleteMembersWarning.replace(
                  '{count}',
                  String(selectedRoleMemberCount),
                )}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setPendingDeleteRoleId(null);
                  onDeleteRole(selectedRole);
                }}
                disabled={state === 'loading'}
                className="rounded-xl bg-rose-100 px-3 py-2 text-xs font-black text-rose-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                {copy.communities.confirmDeleteRole}
              </button>
              <button
                type="button"
                onClick={() => setPendingDeleteRoleId(null)}
                className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white/15"
              >
                {copy.dialog.cancel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type PermissionGroupId =
  | 'administration'
  | 'mentions'
  | 'messages'
  | 'moderation'
  | 'voice';

const PERMISSION_GROUPS: Array<{
  id: PermissionGroupId;
  permissions: CommunityPermission[];
}> = [
  {
    id: 'administration',
    permissions: [
      'view_channels',
      'manage_channels',
      'manage_roles',
      'manage_members',
      'manage_messages',
    ],
  },
  {
    id: 'moderation',
    permissions: [
      'create_invites',
      'approve_members',
      'reject_members',
      'ban_members',
    ],
  },
  {
    id: 'messages',
    permissions: [
      'send_messages',
      'attach_files',
      'embed_links',
      'send_stickers',
      'create_polls',
    ],
  },
  {
    id: 'mentions',
    permissions: ['mention_everyone', 'mention_here', 'mention_roles'],
  },
  {
    id: 'voice',
    permissions: ['connect_voice'],
  },
];

const SENSITIVE_PERMISSIONS = new Set<CommunityPermission>([
  'ban_members',
  'manage_members',
  'manage_messages',
  'manage_roles',
]);

function PermissionToggle({
  onToggle,
  permission,
  selected,
}: {
  onToggle: () => void;
  permission: CommunityPermission;
  selected: boolean;
}) {
  const sensitive = SENSITIVE_PERMISSIONS.has(permission);

  return (
    <label
      className={cx(
        'flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-xs font-black transition',
        selected && sensitive
          ? 'border-amber-300/70 bg-amber-300/20 text-amber-50'
          : selected
            ? 'border-[#c8c0d8]/70 bg-[#c8c0d8]/85 text-[#171426]'
            : sensitive
              ? 'border-amber-300/25 bg-amber-300/5 text-amber-50/80 hover:bg-amber-300/10'
              : 'border-white/10 bg-white/8 text-white/75 hover:bg-white/12 hover:text-white',
      )}
    >
      <span className="min-w-0">
        <span className="block truncate">{permissionLabel(permission)}</span>
        {sensitive && (
          <span className="mt-0.5 block text-[0.6rem] uppercase tracking-[0.12em] opacity-70">
            {copy.communities.sensitivePermission}
          </span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={cx(
          'grid h-5 w-5 shrink-0 place-items-center rounded border text-[0.65rem]',
          selected
            ? sensitive
              ? 'border-amber-100 bg-amber-100 text-amber-950'
              : 'border-[#171426] bg-[#171426] text-white'
            : 'border-white/35',
        )}
      >
        {selected ? '✓' : ''}
      </span>
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="sr-only"
      />
    </label>
  );
}

function permissionGroupLabel(group: PermissionGroupId): string {
  return copy.communities.permissionGroups[group];
}

function permissionLabel(permission: CommunityPermission): string {
  return copy.communities.permissions[permission];
}
