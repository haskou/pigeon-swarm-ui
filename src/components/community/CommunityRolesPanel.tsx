import type {
  CommunityPermission,
  CommunityRoleResource,
} from '../../domain/types';

import { ALL_COMMUNITY_PERMISSIONS } from '../../domain/communities/communityPermissions';
import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';

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
  roles: CommunityRoleResource[];
  selectedRole: CommunityRoleResource | null;
  state: 'idle' | 'loading';
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="flex min-h-[24rem] flex-col rounded-2xl border border-white/10 bg-black/20 p-3">
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => onRoleSelect(role.id)}
              className={cx(
                'block w-full rounded-2xl px-3 py-2 text-left text-sm font-black transition',
                selectedRole?.id === role.id
                  ? 'bg-white text-slate-950'
                  : 'bg-white/8 text-white/75 hover:bg-white/12',
              )}
            >
              {role.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            onRoleSelect('');
            onRoleNameChange('');
          }}
          className="mt-3 w-full rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-950"
        >
          + {copy.communities.role}
        </button>
      </div>
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <input
          value={roleName}
          onChange={(event) => onRoleNameChange(event.target.value)}
          className="mb-4 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-lg font-black text-white outline-none focus:border-cyan-300/60"
          placeholder={copy.communities.roleName}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          {ALL_COMMUNITY_PERMISSIONS.map((permission) => (
            <label
              key={permission}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/8 px-3 py-2 text-xs font-black text-white/75"
            >
              <span>{permission.replace(/_/g, ' ')}</span>
              <input
                type="checkbox"
                checked={rolePermissions.includes(permission)}
                onChange={() => onRolePermissionToggle(permission)}
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={selectedRole ? onUpdateRole : onCreateRole}
            disabled={
              !roleName.trim() || selectedRole?.builtIn || state === 'loading'
            }
            className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {selectedRole
              ? copy.communities.roleSave
              : copy.communities.createRole}
          </button>
          {selectedRole && !selectedRole.builtIn && (
            <button
              type="button"
              onClick={() => onDeleteRole(selectedRole)}
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
      </div>
    </div>
  );
}
