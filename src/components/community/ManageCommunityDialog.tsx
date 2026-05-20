import { UUID } from '@haskou/value-objects';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type {
  Community,
  CommunityChannel,
  CommunityPermission,
  CommunityRoleResource,
  Session,
} from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';
import {
  communityChannels,
  splitCommunityChannels,
} from '../../domain/communities/communityChannels';
import {
  ALL_COMMUNITY_PERMISSIONS,
  communityPermissionsFor,
} from '../../domain/communities/communityPermissions';
import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';
import { shortId } from '../../utils/formatting';
import { toUserErrorMessage } from '../../utils/toUserErrorMessage';
import {
  DialogHeader,
  TrashIcon,
  VoiceIcon,
} from './communityDialogPrimitives';
import { loadPublicImage } from './communityImages';

const ImageCropEditor = lazy(() =>
  import('../common/ImageCropEditor').then((module) => ({
    default: module.ImageCropEditor,
  })),
);

type ManagedCommunityChannel = CommunityChannel & { pending?: boolean };

type ManageCommunityDialogProps = {
  community: Community;
  onClose: () => void;
  onCommunityUpdated: (community: Community) => void;
  session: Session;
};

export function ManageCommunityDialog({
  community,
  onClose,
  onCommunityUpdated,
  session,
}: ManageCommunityDialogProps) {
  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [imageEditor, setImageEditor] = useState<{
    file: File;
    shape: 'avatar' | 'banner';
  } | null>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
  const [currentBannerUrl, setCurrentBannerUrl] = useState<string | null>(null);
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState<'text' | 'voice'>('text');
  const [channelOrder, setChannelOrder] = useState<ManagedCommunityChannel[]>(
    communityChannels(community),
  );
  const [activeSection, setActiveSection] = useState<
    'channels' | 'members' | 'profile' | 'roles'
  >('profile');
  const [roles, setRoles] = useState<CommunityRoleResource[]>(
    community.roles ?? [],
  );
  const [roleName, setRoleName] = useState('');
  const [rolePermissions, setRolePermissions] = useState<CommunityPermission[]>(
    ['view_channels', 'send_messages', 'connect_voice'],
  );
  const [selectedRoleId, setSelectedRoleId] = useState(
    (community.roles ?? []).find((role) => !role.builtIn)?.id ??
      (community.roles ?? [])[0]?.id ??
      '',
  );
  const [memberRoleDrafts, setMemberRoleDrafts] = useState<
    Record<string, string[]>
  >(() =>
    Object.fromEntries(
      (community.memberRoles ?? []).map((assignment) => [
        assignment.identityId,
        assignment.roleIds,
      ]),
    ),
  );
  const [channelPermissionDrafts, setChannelPermissionDrafts] = useState<
    Record<string, string[]>
  >(() =>
    Object.fromEntries(
      communityChannels(community).map((channel) => [
        channel.id,
        channel.permissions?.visibleRoleIds ?? ['everyone'],
      ]),
    ),
  );
  const [deletedChannelIds, setDeletedChannelIds] = useState<string[]>([]);
  const [channelDrafts, setChannelDrafts] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        communityChannels(community).map((channel) => [
          channel.id,
          channel.name,
        ]),
      ),
  );
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading'>('idle');
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const currentPermissions = communityPermissionsFor(
    community,
    session.identity.id,
  );
  const isOwner = community.ownerIdentityId === session.identity.id;
  const canManageChannels =
    isOwner || currentPermissions.has('manage_channels');
  const canManageRoles = isOwner || currentPermissions.has('manage_roles');
  const canBanMembers = isOwner || currentPermissions.has('ban_members');
  const sections = [
    ...(isOwner ? ([['profile', 'Profile']] as const) : []),
    ...(canManageChannels
      ? ([[ 'channels', copy.communities.channels ]] as const)
      : []),
    ...(canManageRoles ? ([['roles', 'Roles']] as const) : []),
    ...(canManageRoles || canBanMembers
      ? ([['members', copy.communities.members]] as const)
      : []),
  ];

  useEffect(() => {
    if (!avatar) {
      setAvatarPreview(null);

      return undefined;
    }

    const nextPreview = URL.createObjectURL(avatar);

    setAvatarPreview(nextPreview);

    return () => URL.revokeObjectURL(nextPreview);
  }, [avatar]);

  useEffect(() => {
    if (!banner) {
      setBannerPreview(null);

      return undefined;
    }

    const nextPreview = URL.createObjectURL(banner);

    setBannerPreview(nextPreview);

    return () => URL.revokeObjectURL(nextPreview);
  }, [banner]);

  useEffect(() => {
    let cancelled = false;

    setCurrentAvatarUrl(null);

    if (!community.avatar) return undefined;

    void loadPublicImage(community.avatar).then((url) => {
      if (!cancelled) setCurrentAvatarUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [community.avatar]);

  useEffect(() => {
    let cancelled = false;

    setCurrentBannerUrl(null);

    if (!community.banner) return undefined;

    void loadPublicImage(community.banner).then((url) => {
      if (!cancelled) setCurrentBannerUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [community.banner]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const role = roles.find((candidate) => candidate.id === selectedRoleId);

    if (!role) return;

    setRoleName(role.name);
    setRolePermissions(role.permissions);
  }, [roles, selectedRoleId]);

  useEffect(() => {
    if (sections.some(([section]) => section === activeSection)) return;

    setActiveSection(sections[0]?.[0] ?? 'profile');
  }, [activeSection, sections]);

  const selectedRole =
    roles.find((role) => role.id === selectedRoleId) ?? roles[0] ?? null;
  const editableRoles = roles.filter((role) => !role.builtIn);
  const bannedMemberIds = new Set(community.bannedMemberIds ?? []);

  const refreshCommunity = async () => {
    const freshCommunity = await pigeonApplication.getCommunity(
      session,
      community.id,
    );

    onCommunityUpdated(freshCommunity);
    setRoles(freshCommunity.roles ?? []);
    setMemberRoleDrafts(
      Object.fromEntries(
        (freshCommunity.memberRoles ?? []).map((assignment) => [
          assignment.identityId,
          assignment.roleIds,
        ]),
      ),
    );

    return freshCommunity;
  };

  const togglePermission = (permission: CommunityPermission) => {
    setRolePermissions((current) =>
      current.includes(permission)
        ? current.filter((candidate) => candidate !== permission)
        : [...current, permission],
    );
  };

  const toggleMemberRole = (identityId: string, roleId: string) => {
    setMemberRoleDrafts((current) => {
      const roleIds = new Set(current[identityId] ?? []);

      if (roleIds.has(roleId)) {
        roleIds.delete(roleId);
      } else {
        roleIds.add(roleId);
      }

      return { ...current, [identityId]: [...roleIds] };
    });
  };

  const toggleChannelRole = (channelId: string, roleId: string) => {
    setChannelPermissionDrafts((current) => {
      const roleIds = new Set(current[channelId] ?? ['everyone']);

      if (roleId === 'everyone') {
        return { ...current, [channelId]: ['everyone'] };
      }

      roleIds.delete('everyone');

      if (roleIds.has(roleId)) {
        roleIds.delete(roleId);
      } else {
        roleIds.add(roleId);
      }

      return {
        ...current,
        [channelId]: roleIds.size > 0 ? [...roleIds] : ['everyone'],
      };
    });
  };

  const createRole = async () => {
    const nextName = roleName.trim();

    if (!nextName || state === 'loading') return;

    setState('loading');
    setError(null);
    try {
      const role = await pigeonApplication.createCommunityRole(
        session,
        community.id,
        {
          name: nextName,
          permissions: rolePermissions,
        },
      );

      setRoleName('');
      setSelectedRoleId(role.id);
      await refreshCommunity();
    } catch (caught) {
      setError(toUserErrorMessage(caught, 'The role could not be saved.'));
    } finally {
      setState('idle');
    }
  };

  const updateRole = async () => {
    if (!selectedRole || selectedRole.builtIn || state === 'loading') return;

    setState('loading');
    setError(null);
    try {
      await pigeonApplication.updateCommunityRole(
        session,
        community.id,
        selectedRole.id,
        {
          name: roleName.trim() || selectedRole.name,
          permissions: rolePermissions,
        },
      );
      await refreshCommunity();
    } catch (caught) {
      setError(toUserErrorMessage(caught, 'The role could not be saved.'));
    } finally {
      setState('idle');
    }
  };

  const deleteRole = async (role: CommunityRoleResource) => {
    if (role.builtIn || state === 'loading') return;

    setState('loading');
    setError(null);
    try {
      await pigeonApplication.deleteCommunityRole(session, community.id, role.id);
      setSelectedRoleId('');
      await refreshCommunity();
    } catch (caught) {
      setError(toUserErrorMessage(caught, 'The role could not be deleted.'));
    } finally {
      setState('idle');
    }
  };

  const saveMemberRoles = async (identityId: string) => {
    setState('loading');
    setError(null);
    try {
      await pigeonApplication.assignCommunityMemberRoles(
        session,
        community.id,
        identityId,
        memberRoleDrafts[identityId] ?? [],
      );
      await refreshCommunity();
    } catch (caught) {
      setError(toUserErrorMessage(caught, 'Member roles could not be saved.'));
    } finally {
      setState('idle');
    }
  };

  const banMember = async (identityId: string) => {
    setState('loading');
    setError(null);
    try {
      await pigeonApplication.banCommunityMember(session, community.id, identityId);
      await refreshCommunity();
    } catch (caught) {
      setError(toUserErrorMessage(caught, 'The member could not be banned.'));
    } finally {
      setState('idle');
    }
  };

  const unbanMember = async (identityId: string) => {
    setState('loading');
    setError(null);
    try {
      await pigeonApplication.unbanCommunityMember(
        session,
        community.id,
        identityId,
      );
      await refreshCommunity();
    } catch (caught) {
      setError(toUserErrorMessage(caught, 'The member could not be unbanned.'));
    } finally {
      setState('idle');
    }
  };

  const saveChanges = async (): Promise<boolean> => {
    if (state === 'loading') return false;

    if (
      channelOrder.some(
        (channel) => !(channelDrafts[channel.id] ?? channel.name).trim(),
      )
    ) {
      setError(copy.communities.channelError);

      return false;
    }

    setState('loading');
    setError(null);
    try {
      let updatedCommunity = await pigeonApplication.updateCommunity(
        session,
        community.id,
        {
          avatar: avatar ?? community.avatar,
          banner: banner ?? community.banner,
          description: description.trim(),
          name: name.trim(),
        },
      );

      for (const channelId of deletedChannelIds) {
        updatedCommunity = await pigeonApplication.deleteCommunityChannel(
          session,
          community.id,
          channelId,
        );
      }

      const updatedChannels: CommunityChannel[] = [];

      for (const channel of channelOrder) {
        const nextName = (channelDrafts[channel.id] ?? channel.name).trim();
        let nextChannel: CommunityChannel;

        if (channel.pending) {
          nextChannel =
            channel.type === 'text'
              ? await pigeonApplication.createCommunityTextChannel(
                  session,
                  community.id,
                  nextName,
                )
              : await pigeonApplication.createCommunityVoiceChannel(
                  session,
                  community.id,
                  nextName,
                );
        } else if (nextName === channel.name) {
          nextChannel = channel;
        } else {
          nextChannel = await pigeonApplication.renameCommunityChannel(
            session,
            community.id,
            channel.id,
            nextName,
          );
        }

        const visibleRoleIds = channelPermissionDrafts[channel.id] ?? [
          'everyone',
        ];

        if (!channel.pending) {
          nextChannel =
            await pigeonApplication.updateCommunityChannelPermissions(
              session,
              community.id,
              nextChannel.id,
              visibleRoleIds,
            );
        }

        updatedChannels.push(nextChannel);
      }

      onCommunityUpdated({
        ...updatedCommunity,
        ...splitCommunityChannels(updatedChannels),
      });

      return true;
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.communities.updateError));

      return false;
    } finally {
      setState('idle');
    }
  };

  const finishManage = async () => {
    const saved = await saveChanges();

    if (!saved) return;
    onClose();
  };

  const createChannel = () => {
    const nextName = channelName.trim();

    if (!nextName || state === 'loading') return;

    setError(null);
    const channel: ManagedCommunityChannel =
      channelType === 'text'
        ? {
            createdAt: Date.now(),
            id: draftChannelId(),
            name: nextName,
            pending: true,
            type: 'text',
          }
        : {
            connectedIdentityIds: [],
            createdAt: Date.now(),
            id: draftChannelId(),
            name: nextName,
            pending: true,
            type: 'voice',
          };

    setChannelName('');
    setChannelOrder((current) => [...current, channel]);
    setChannelDrafts((current) => ({
      ...current,
      [channel.id]: channel.name,
    }));
    setChannelPermissionDrafts((current) => ({
      ...current,
      [channel.id]: ['everyone'],
    }));
  };

  const moveChannel = (channelId: string, direction: -1 | 1) => {
    const index = channelOrder.findIndex((channel) => channel.id === channelId);
    const nextIndex = index + direction;

    if (index < 0 || nextIndex < 0 || nextIndex >= channelOrder.length) return;

    const nextChannels = [...channelOrder];
    const [channel] = nextChannels.splice(index, 1);

    nextChannels.splice(nextIndex, 0, channel);
    setChannelOrder(nextChannels);
  };

  const deleteChannel = (channel: ManagedCommunityChannel) => {
    if (
      channel.type === 'text' &&
      !window.confirm(copy.communities.deleteChannelConfirm)
    )
      return;

    setChannelOrder((current) =>
      current.filter((candidate) => candidate.id !== channel.id),
    );
    setChannelDrafts((current) => {
      const remaining = { ...current };

      delete remaining[channel.id];

      return remaining;
    });

    if (!channel.pending) {
      setDeletedChannelIds((current) =>
        current.includes(channel.id) ? current : [...current, channel.id],
      );
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-stretch bg-black/60 p-0 backdrop-blur-md sm:place-items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <section className="glass-panel-strong relative z-10 flex max-h-screen w-full flex-col overflow-hidden rounded-none p-5 shadow-2xl shadow-black/40 sm:max-h-[88vh] sm:max-w-5xl sm:rounded-2xl">
        <DialogHeader title={copy.communities.manage} onClose={onClose} />
        <div className="mb-4 grid gap-2 rounded-2xl bg-black/20 p-1 sm:grid-cols-4">
          {sections.map(([section, label]) => (
            <button
              key={section}
              type="button"
              onClick={() => setActiveSection(section)}
              className={cx(
                'rounded-2xl px-3 py-2 text-xs font-black transition',
                activeSection === section
                  ? 'bg-white text-slate-950'
                  : 'text-white/55 hover:bg-white/10',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid gap-5 lg:items-start">
            {activeSection === 'profile' && (
            <div className="overflow-hidden rounded-2xl bg-black/25">
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                className="group relative block aspect-[3/1] w-full overflow-hidden bg-gradient-to-br from-slate-900 via-fuchsia-950 to-cyan-900"
                aria-label={copy.communities.banner}
              >
                {bannerPreview || currentBannerUrl ? (
                  <img
                    src={bannerPreview ?? currentBannerUrl ?? ''}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="grid h-full w-full place-items-center text-4xl font-black text-white/80">
                    {community.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="absolute inset-0 grid place-items-center bg-black/0 text-3xl text-white opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100">
                  ✎
                </span>
              </button>
              <div className="relative px-4 pb-4">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="group relative -mt-8 grid h-20 w-20 place-items-center overflow-hidden rounded-2xl border-4 border-[#1f1f27] bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-3xl font-black text-slate-950 shadow-xl shadow-black/35"
                  aria-label={copy.communities.avatar}
                >
                  {avatarPreview || currentAvatarUrl ? (
                    <img
                      src={avatarPreview ?? currentAvatarUrl ?? ''}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    community.name.slice(0, 1).toUpperCase()
                  )}
                  <span className="absolute inset-0 grid place-items-center bg-black/0 text-2xl text-white opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100">
                    ✎
                  </span>
                </button>
                <div className="mt-4 grid gap-3">
                  <input
                    aria-label={copy.communities.name}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-lg font-black text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                  />
                  <textarea
                    aria-label={copy.communities.description}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="min-h-20 w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                  />
                </div>
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];

                  if (file) setImageEditor({ file, shape: 'avatar' });
                  event.target.value = '';
                }}
                className="sr-only"
              />
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];

                  if (file) setImageEditor({ file, shape: 'banner' });
                  event.target.value = '';
                }}
                className="sr-only"
              />
            </div>
            )}

            {activeSection === 'channels' && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-white/35">
                {copy.communities.channels}
              </div>
              <div className="max-h-[48vh] space-y-2 overflow-y-auto pr-1">
                {channelOrder.map((channel, index) => (
                  <div
                    key={channel.id}
                    className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/8 p-2"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-2xl bg-white/8 text-white/55">
                      {channel.type === 'voice' ? <VoiceIcon /> : '#'}
                    </span>
                    <input
                      value={channelDrafts[channel.id] ?? channel.name}
                      onChange={(event) =>
                        setChannelDrafts((current) => ({
                          ...current,
                          [channel.id]: event.target.value,
                        }))
                      }
                      className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60"
                    />
                    <span className="hidden rounded-2xl bg-black/25 px-2 py-2 text-[0.65rem] font-black uppercase tracking-[0.12em] text-white/35 sm:block">
                      {channel.type === 'voice'
                        ? copy.communities.voiceChannel
                        : copy.communities.textChannel}
                    </span>
                    <button
                      type="button"
                      onClick={() => moveChannel(channel.id, -1)}
                      disabled={index === 0}
                      className="grid h-9 w-9 place-items-center rounded-2xl bg-white/10 font-black disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label={copy.communities.moveChannelUp}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveChannel(channel.id, 1)}
                      disabled={index === channelOrder.length - 1}
                      className="grid h-9 w-9 place-items-center rounded-2xl bg-white/10 font-black disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label={copy.communities.moveChannelDown}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteChannel(channel)}
                      disabled={state === 'loading'}
                      className="grid h-9 w-9 place-items-center rounded-2xl bg-rose-500/15 text-rose-100 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label={copy.communities.deleteChannel}
                      title={copy.communities.deleteChannel}
                    >
                      <TrashIcon />
                    </button>
                    <div className="w-full rounded-2xl bg-black/20 p-2">
                      <div className="mb-2 text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/35">
                        Visible roles
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {roles.map((role) => (
                          <label
                            key={`${channel.id}:${role.id}`}
                            className="flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2 text-xs font-black text-white/70"
                          >
                            <input
                              type="checkbox"
                              checked={(
                                channelPermissionDrafts[channel.id] ?? [
                                  'everyone',
                                ]
                              ).includes(role.id)}
                              onChange={() =>
                                toggleChannelRole(channel.id, role.id)
                              }
                            />
                            {role.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-black/20 p-1">
                {(['text', 'voice'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setChannelType(type)}
                    className={cx(
                      'rounded-2xl px-3 py-2 text-xs font-black transition',
                      channelType === type
                        ? 'bg-white text-slate-950'
                        : 'text-white/55 hover:bg-white/10',
                    )}
                  >
                    {type === 'voice'
                      ? copy.communities.voiceChannel
                      : copy.communities.textChannel}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  value={channelName}
                  onChange={(event) => setChannelName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    void createChannel();
                  }}
                  className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                  placeholder={copy.communities.addChannelPlaceholder}
                />
                <button
                  type="button"
                  onClick={() => void createChannel()}
                  disabled={!channelName.trim() || state === 'loading'}
                  className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  +
                </button>
              </div>
            </div>
            )}
          </div>
          {activeSection === 'roles' && (
            <RolesPanel
              editableRoles={editableRoles}
              onCreateRole={() => void createRole()}
              onDeleteRole={(role) => void deleteRole(role)}
              onRoleNameChange={setRoleName}
              onRolePermissionToggle={togglePermission}
              onRoleSelect={setSelectedRoleId}
              onUpdateRole={() => void updateRole()}
              roleName={roleName}
              rolePermissions={rolePermissions}
              roles={roles}
              selectedRole={selectedRole}
              state={state}
            />
          )}
          {activeSection === 'members' && (
            <MembersAndBansPanel
              bannedMemberIds={community.bannedMemberIds ?? []}
              editableRoles={editableRoles}
              memberIds={community.memberIds}
              memberRoleDrafts={memberRoleDrafts}
              onBan={(identityId) => void banMember(identityId)}
              onSaveRoles={(identityId) => void saveMemberRoles(identityId)}
              onToggleMemberRole={toggleMemberRole}
              onUnban={(identityId) => void unbanMember(identityId)}
              ownerIdentityId={community.ownerIdentityId}
              state={state}
            />
          )}
          {error && (
            <div className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-3 text-xs text-rose-100">
              {error}
            </div>
          )}
        </div>
        {(activeSection === 'profile' || activeSection === 'channels') && (
          <button
            type="button"
            onClick={() => void finishManage()}
            disabled={!name.trim() || state === 'loading'}
            className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {copy.profile.save}
          </button>
        )}
        {imageEditor && (
          <Suspense fallback={null}>
            <ImageCropEditor
              file={imageEditor.file}
              shape={imageEditor.shape}
              onClose={() => setImageEditor(null)}
              onApply={(file, previewUrl) => {
                if (imageEditor.shape === 'avatar') {
                  setAvatar(file);
                  setAvatarPreview(previewUrl);
                } else {
                  setBanner(file);
                  setBannerPreview(previewUrl);
                }
              }}
            />
          </Suspense>
        )}
      </section>
    </div>,
    document.body,
  );
}

function RolesPanel({
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
      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
        <button
          type="button"
          onClick={() => {
            onRoleSelect('');
            onRoleNameChange('');
          }}
          className="mb-3 w-full rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-950"
        >
          + Role
        </button>
        <div className="space-y-2">
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
      </div>
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <input
          value={roleName}
          onChange={(event) => onRoleNameChange(event.target.value)}
          className="mb-4 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-lg font-black text-white outline-none focus:border-cyan-300/60"
          placeholder="Role name"
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
            disabled={!roleName.trim() || selectedRole?.builtIn || state === 'loading'}
            className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {selectedRole ? 'Save role' : 'Create role'}
          </button>
          {selectedRole && !selectedRole.builtIn && (
            <button
              type="button"
              onClick={() => onDeleteRole(selectedRole)}
              disabled={state === 'loading'}
              className="rounded-2xl bg-rose-500/15 px-4 py-2 text-sm font-black text-rose-100 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Delete role
            </button>
          )}
          {editableRoles.length === 0 && (
            <span className="py-2 text-xs text-white/45">
              Create a custom role to assign it to members.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function MembersAndBansPanel({
  bannedMemberIds,
  editableRoles,
  memberIds,
  memberRoleDrafts,
  onBan,
  onSaveRoles,
  onToggleMemberRole,
  onUnban,
  ownerIdentityId,
  state,
}: {
  bannedMemberIds: string[];
  editableRoles: CommunityRoleResource[];
  memberIds: string[];
  memberRoleDrafts: Record<string, string[]>;
  onBan: (identityId: string) => void;
  onSaveRoles: (identityId: string) => void;
  onToggleMemberRole: (identityId: string, roleId: string) => void;
  onUnban: (identityId: string) => void;
  ownerIdentityId: string;
  state: 'idle' | 'loading';
}) {
  const banned = new Set(bannedMemberIds);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)]">
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-white/35">
          Members
        </div>
        <div className="space-y-3">
          {memberIds
            .filter((identityId) => !banned.has(identityId))
            .map((identityId) => (
              <div key={identityId} className="rounded-2xl bg-white/8 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 truncate text-sm font-black text-white">
                    {shortId(identityId)}
                    {identityId === ownerIdentityId ? ' · owner' : ''}
                  </div>
                  {identityId !== ownerIdentityId && (
                    <button
                      type="button"
                      onClick={() => onBan(identityId)}
                      disabled={state === 'loading'}
                      className="rounded-xl bg-rose-500/15 px-3 py-2 text-xs font-black text-rose-100 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Ban
                    </button>
                  )}
                </div>
                {editableRoles.length > 0 && (
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
                      Save roles
                    </button>
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-white/35">
          Banned
        </div>
        {bannedMemberIds.length === 0 ? (
          <div className="rounded-2xl bg-white/8 p-4 text-sm text-white/45">
            No banned members.
          </div>
        ) : (
          <div className="space-y-2">
            {bannedMemberIds.map((identityId) => (
              <div
                key={identityId}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white/8 p-3"
              >
                <span className="min-w-0 truncate text-sm font-black text-white">
                  {shortId(identityId)}
                </span>
                <button
                  type="button"
                  onClick={() => onUnban(identityId)}
                  disabled={state === 'loading'}
                  className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Unban
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function draftChannelId(): string {
  return `draft:${UUID.generate().toString()}`;
}
