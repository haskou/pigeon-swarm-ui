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
  const [pendingDeleteRoleId, setPendingDeleteRoleId] = useState<string | null>(
    null,
  );
  const selectedRoleIsBuiltIn = selectedRole?.builtIn ?? false;
  const displayedRoleName =
    selectedRoleIsBuiltIn && selectedRole
      ? communityRoleDisplayName(selectedRole)
      : roleName;
  const selectedRoleMemberCount = selectedRole
    ? (roleMemberCounts[selectedRole.id] ?? 0)
    : 0;

  return (
    <div className="grid min-h-0 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <div className="flex min-h-0 flex-col border-y border-white/10 py-2 lg:border-r lg:border-y-0 lg:pr-4">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => onRoleSelect(role.id)}
              className={cx(
                'block w-full border-l-2 px-3 py-2.5 text-left text-sm font-black transition',
                selectedRole?.id === role.id
                  ? 'border-cyan-300/80 bg-cyan-300/10 text-cyan-50'
                  : 'border-transparent text-white/65 hover:bg-white/[0.06] hover:text-white',
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
          className="ui-button mt-3 w-full shrink-0"
        >
          + {copy.communities.role}
        </button>
      </div>
      <div className="ui-list-block min-w-0">
        <input
          value={displayedRoleName}
          onChange={(event) => {
            if (selectedRoleIsBuiltIn) return;

            onRoleNameChange(event.target.value);
          }}
          readOnly={selectedRoleIsBuiltIn}
          className={cx(
            'ui-field-control mb-4 w-full px-4 py-3 text-lg font-black',
            selectedRoleIsBuiltIn && 'cursor-default',
          )}
          placeholder={copy.communities.roleName}
        />
        <div className="border-y border-white/10">
          {PERMISSION_GROUPS.map((group) => (
            <section
              key={group.id}
              className="border-b border-white/10 py-3 last:border-b-0"
            >
              <div className="mb-2 text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/35">
                {permissionGroupLabel(group.id)}
              </div>
              <div className="grid sm:grid-cols-2 sm:gap-x-4">
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
            className="ui-button ui-button-primary disabled:cursor-not-allowed disabled:opacity-45"
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
              className="ui-button border-rose-300/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-45"
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
        'flex min-h-12 cursor-pointer items-center justify-between gap-3 border-b border-white/10 px-2 py-2 text-xs transition last:border-b-0 hover:bg-white/[0.04]',
        sensitive ? 'text-amber-50/85' : 'text-white/75',
      )}
    >
      <span className="min-w-0">
        <span className="block truncate font-bold">
          {permissionLabel(permission)}
        </span>
        {sensitive && (
          <span className="mt-0.5 block text-[0.6rem] font-black uppercase tracking-[0.12em] text-amber-200/55">
            {copy.communities.sensitivePermission}
          </span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={cx(
          'relative h-6 w-11 shrink-0 rounded-full border transition',
          selected
            ? sensitive
              ? 'border-amber-200/35 bg-amber-300/45'
              : 'border-cyan-200/30 bg-cyan-400/55'
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
