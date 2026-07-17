import { UUID } from '@haskou/value-objects';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type {
  Community,
  CommunityChannel,
  CommunityMembershipRequest,
  CommunityModerationLog,
  CommunityPermission,
  CommunityRoleResource,
  IdentityResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { shortId } from '../../../../shared/presentation/formatting';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';
import { CommunityAccessPolicy } from '../view-models/CommunityAccessPolicy';
import { CommunityChannels } from '../view-models/CommunityChannels';
import { CommunityBannedMembersPanel } from './CommunityBannedMembersPanel';
import { DialogHeader } from './communityDialogPrimitives';
import { loadIdentityPicture, loadPublicImage } from './communityImages';
import { CommunityInvitationsPanel } from './CommunityInvitationsPanel';
import { CommunityMembersRolesPanel } from './CommunityMembersRolesPanel';
import { CommunityModerationLogsPanel } from './CommunityModerationLogsPanel';
import { CommunityRolesPanel } from './CommunityRolesPanel';
import {
  CommunitySettingsNavigation,
  type CommunitySettingsSection,
} from './communitySettingsNavigation';
import { ManageCommunityChannelsPanel } from './ManageCommunityChannelsPanel';
import { ManageCommunityProfilePanel } from './ManageCommunityProfilePanel';
import {
  ManagedCommunityChannels,
  type ManagedCommunityChannel,
} from './ManagedCommunityChannels';

const ImageCropEditor = lazy(() =>
  import('../../../../shared/presentation/components/ImageCropEditor').then(
    (module) => ({
      default: module.ImageCropEditor,
    }),
  ),
);

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
  const { close, state: transitionState } = useCloseTransition(onClose);

  useCloseOnEscape(close);

  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const communityCanAutoJoin = community.visibility === 'public';
  const [autoJoinEnabled, setAutoJoinEnabled] = useState(
    communityCanAutoJoin ? (community.autoJoinEnabled ?? false) : false,
  );
  const [discoverable, setDiscoverable] = useState(
    community.discoverable ?? true,
  );
  const [imageEditor, setImageEditor] = useState<{
    file: File;
    shape: 'avatar' | 'banner';
  } | null>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
  const [currentBannerUrl, setCurrentBannerUrl] = useState<string | null>(null);
  const [memberIdentities, setMemberIdentities] = useState<
    Record<string, IdentityResource>
  >({});
  const [memberPictures, setMemberPictures] = useState<Record<string, string>>(
    {},
  );
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState<'text' | 'voice'>('text');
  const [channelOrder, setChannelOrder] = useState<ManagedCommunityChannel[]>(
    CommunityChannels.all(community),
  );
  const [pendingChannelDeleteId, setPendingChannelDeleteId] = useState<
    string | null
  >(null);
  const [lastSavedSection, setLastSavedSection] =
    useState<CommunitySettingsSection | null>(null);
  const originalChannelIdsRef = useRef(
    CommunityChannels.all(community).map((channel) => channel.id),
  );
  const [activeSection, setActiveSection] =
    useState<CommunitySettingsSection>('profile');
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
      CommunityChannels.all(community).map((channel) => [
        channel.id,
        channel.permissions?.visibleRoleIds ?? ['everyone'],
      ]),
    ),
  );
  const [deletedChannelIds, setDeletedChannelIds] = useState<string[]>([]);
  const [membershipRequests, setMembershipRequests] = useState<
    CommunityMembershipRequest[]
  >([]);
  const [moderationLogs, setModerationLogs] = useState<
    CommunityModerationLog[]
  >([]);
  const [nextModerationLogId, setNextModerationLogId] = useState<
    string | undefined
  >(undefined);
  const [inviteIdentityInput, setInviteIdentityInput] = useState('');
  const [channelDrafts, setChannelDrafts] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        CommunityChannels.all(community).map((channel) => [
          channel.id,
          channel.name,
        ]),
      ),
  );
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading'>('idle');
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const currentPermissions = CommunityAccessPolicy.permissionsFor(
    community,
    session.identity.id,
  );
  const isOwner = community.ownerIdentityId === session.identity.id;
  const canManageChannels =
    isOwner || currentPermissions.has('manage_channels');
  const canManageRoles = isOwner || currentPermissions.has('manage_roles');
  const canBanMembers = isOwner || currentPermissions.has('ban_members');
  const canManageMembers = isOwner || currentPermissions.has('manage_members');
  const canCreateInvitations =
    isOwner || currentPermissions.has('create_invites');
  const canApproveRequests =
    isOwner || currentPermissions.has('approve_members');
  const canRejectRequests = isOwner || currentPermissions.has('reject_members');
  const sections = [
    ...(isOwner
      ? ([['profile', copy.communities.publicProfile]] as const)
      : []),
    ...(canManageChannels
      ? ([['channels', copy.communities.channels]] as const)
      : []),
    ...(canManageRoles ? ([['roles', copy.communities.roles]] as const) : []),
    ...(canManageRoles || canBanMembers || canManageMembers
      ? ([['members', copy.communities.members]] as const)
      : []),
    ...(canBanMembers
      ? ([['banned-members', copy.communities.bannedMembers]] as const)
      : []),
    ...(canCreateInvitations || canApproveRequests || canRejectRequests
      ? ([['invitations', copy.communities.invitations]] as const)
      : []),
    ...(canManageMembers
      ? ([['moderation-logs', copy.communities.moderationLogs]] as const)
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
    let cancelled = false;

    void Promise.all(
      community.memberIds.map(async (identityId) => {
        try {
          const identity =
            identityId === session.identity.id
              ? session.identity
              : await applicationContainer.identities.get(
                  IdentityId.normalize(identityId),
                );
          const pictureUrl = await loadIdentityPicture(identity);

          return [identityId, identity, pictureUrl] as const;
        } catch {
          return [identityId, undefined, null] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;

      const nextIdentities: Record<string, IdentityResource> = {};
      const nextPictures: Record<string, string> = {};

      for (const [identityId, identity, pictureUrl] of entries) {
        if (identity) nextIdentities[identityId] = identity;

        if (pictureUrl) nextPictures[identityId] = pictureUrl;
      }

      setMemberIdentities(nextIdentities);
      setMemberPictures(nextPictures);
    });

    return () => {
      cancelled = true;
    };
  }, [community.memberIds, session.identity]);

  useEffect(() => {
    const availableSection = sections.some(
      ([section]) => section === activeSection,
    );

    if (!availableSection && sections[0]) {
      setActiveSection(sections[0][0]);
    }
  }, [activeSection, sections]);

  useEffect(() => {
    if (activeSection !== 'invitations') return;

    void refreshMembershipRequests();
  }, [activeSection, community.id, session.identity.id]);

  useEffect(() => {
    if (activeSection !== 'moderation-logs') return;

    void refreshModerationLogs();
  }, [activeSection, community.id, session.identity.id]);

  useEffect(() => {
    const knownIdentityIds = new Set(Object.keys(memberIdentities));
    const requestIdentityIds = membershipRequests.flatMap((request) => [
      request.creatorIdentityId,
      request.identityId,
    ]);
    const missingIdentityIds = [...new Set(requestIdentityIds)].filter(
      (identityId) => !knownIdentityIds.has(identityId),
    );

    if (missingIdentityIds.length === 0) return;

    let cancelled = false;

    void Promise.all(
      missingIdentityIds.map(async (identityId) => {
        try {
          const identity =
            identityId === session.identity.id
              ? session.identity
              : await applicationContainer.identities.get(
                  IdentityId.normalize(identityId),
                );

          return [identityId, identity] as const;
        } catch {
          return [identityId, undefined] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;

      setMemberIdentities((current) => {
        const next = { ...current };

        for (const [identityId, identity] of entries) {
          if (identity) next[identityId] = identity;
        }

        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [memberIdentities, membershipRequests, session.identity]);

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

  const selectedRole = selectedRoleId
    ? (roles.find((role) => role.id === selectedRoleId) ?? null)
    : null;
  const editableRoles = roles.filter((role) => !role.builtIn);
  const roleMemberCounts = roles.reduce<Record<string, number>>(
    (counts, role) => ({
      ...counts,
      [role.id]:
        role.id === 'everyone'
          ? community.memberIds.length
          : (community.memberRoles ?? []).filter((assignment) =>
              assignment.roleIds.includes(role.id),
            ).length,
    }),
    {},
  );

  const refreshCommunity = async () => {
    const freshCommunity = await applicationContainer.communities.get(
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

  const toggleMemberRole = async (identityId: string, roleId: string) => {
    if (state === 'loading') return;

    const previousRoleIds = memberRoleDrafts[identityId] ?? [];
    const nextRoleIds = toggleRoleId(previousRoleIds, roleId);

    setMemberRoleDrafts((current) => ({
      ...current,
      [identityId]: nextRoleIds,
    }));
    setState('loading');
    setError(null);
    try {
      await applicationContainer.communities.assignMemberRoles(
        session,
        community.id,
        identityId,
        nextRoleIds,
      );
      await refreshCommunity();
    } catch (caught) {
      setMemberRoleDrafts((current) => ({
        ...current,
        [identityId]: previousRoleIds,
      }));
      setError(toUserErrorMessage(caught, copy.communities.memberRolesError));
    } finally {
      setState('idle');
    }
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
      const role = await applicationContainer.communities.createRole(
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
      setError(toUserErrorMessage(caught, copy.communities.roleSaveError));
    } finally {
      setState('idle');
    }
  };

  const updateRole = async () => {
    if (!selectedRole || state === 'loading') return;

    setState('loading');
    setError(null);
    try {
      await applicationContainer.communities.updateRole(
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
      setError(toUserErrorMessage(caught, copy.communities.roleSaveError));
    } finally {
      setState('idle');
    }
  };

  const deleteRole = async (role: CommunityRoleResource) => {
    if (role.builtIn || state === 'loading') return;

    setState('loading');
    setError(null);
    try {
      await applicationContainer.communities.deleteRole(
        session,
        community.id,
        role.id,
      );
      setSelectedRoleId('');
      await refreshCommunity();
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.communities.roleDeleteError));
    } finally {
      setState('idle');
    }
  };

  const banMember = async (identityId: string) => {
    setState('loading');
    setError(null);
    try {
      await applicationContainer.communities.banMember(
        session,
        community.id,
        identityId,
      );
      await refreshCommunity();
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.communities.banMemberError));
    } finally {
      setState('idle');
    }
  };

  const refreshMembershipRequests = async () => {
    setState('loading');
    setError(null);
    try {
      const requests =
        await applicationContainer.communities.listMembershipRequests(session);

      setMembershipRequests(
        requests.filter((request) => request.communityId === community.id),
      );
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.communities.membershipError));
    } finally {
      setState('idle');
    }
  };

  const refreshModerationLogs = async () => {
    setState('loading');
    setError(null);
    try {
      const page = await applicationContainer.communities.listModerationLogs(
        session,
        community.id,
        { limit: 50 },
      );

      setModerationLogs(page.logs);
      setNextModerationLogId(page.nextBeforeLogId);
    } catch (caught) {
      setError(
        toUserErrorMessage(caught, copy.communities.moderationLogsError),
      );
    } finally {
      setState('idle');
    }
  };

  const loadMoreModerationLogs = async () => {
    if (!nextModerationLogId || state === 'loading') return;

    setState('loading');
    setError(null);
    try {
      const page = await applicationContainer.communities.listModerationLogs(
        session,
        community.id,
        { beforeLogId: nextModerationLogId, limit: 50 },
      );

      setModerationLogs((current) => [...current, ...page.logs]);
      setNextModerationLogId(page.nextBeforeLogId);
    } catch (caught) {
      setError(
        toUserErrorMessage(caught, copy.communities.moderationLogsError),
      );
    } finally {
      setState('idle');
    }
  };

  const inviteMember = async () => {
    const identityId = IdentityId.normalize(inviteIdentityInput);

    if (!identityId || state === 'loading') return;

    setState('loading');
    setError(null);
    try {
      const request = await applicationContainer.communities.addMember(
        session,
        community.id,
        identityId,
      );

      setInviteIdentityInput('');
      setMembershipRequests((current) => [
        request,
        ...current.filter((item) => item.id !== request.id),
      ]);
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.communities.memberError));
    } finally {
      setState('idle');
    }
  };

  const updateMembershipRequest = async (
    requestId: string,
    status: 'accepted' | 'declined',
  ) => {
    setState('loading');
    setError(null);
    try {
      const request =
        await applicationContainer.communities.updateMembershipRequest(
          session,
          requestId,
          status,
        );

      setMembershipRequests((current) =>
        current.map((item) => (item.id === request.id ? request : item)),
      );

      if (status === 'accepted') {
        await refreshCommunity();
      }
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.communities.membershipError));
    } finally {
      setState('idle');
    }
  };

  const kickMember = async (identityId: string) => {
    setState('loading');
    setError(null);
    try {
      await applicationContainer.communities.kickMember(
        session,
        community.id,
        identityId,
      );
      await refreshCommunity();
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.communities.kickMemberError));
    } finally {
      setState('idle');
    }
  };

  const unbanMember = async (identityId: string) => {
    setState('loading');
    setError(null);
    try {
      await applicationContainer.communities.unbanMember(
        session,
        community.id,
        identityId,
      );
      await refreshCommunity();
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.communities.unbanMemberError));
    } finally {
      setState('idle');
    }
  };

  const channelDraftInput = {
    channelDrafts,
    channelOrder,
    channelPermissionDrafts,
    deletedChannelIds,
    originalChannelIds: originalChannelIdsRef.current,
  };
  const effectiveAutoJoinEnabled = communityCanAutoJoin
    ? autoJoinEnabled
    : false;
  const savedAutoJoinEnabled = community.autoJoinEnabled ?? false;
  const hasProfileChanges =
    avatar !== null ||
    banner !== null ||
    name.trim() !== community.name ||
    effectiveAutoJoinEnabled !== savedAutoJoinEnabled ||
    description.trim() !== community.description ||
    discoverable !== (community.discoverable ?? true);
  const hasChannelChanges =
    ManagedCommunityChannels.hasChanges(channelDraftInput);
  const hasManageCommunityChanges = hasProfileChanges || hasChannelChanges;
  const activeSectionHasExternalChanges =
    activeSection === 'profile'
      ? hasChannelChanges
      : activeSection === 'channels'
        ? hasProfileChanges
        : hasManageCommunityChanges;
  const activeSectionSaveLabel =
    state === 'loading'
      ? copy.profile.saving
      : lastSavedSection === activeSection
        ? copy.communities.saved
        : activeSectionHasExternalChanges
          ? copy.communities.saveChanges
          : activeSection === 'channels'
            ? copy.communities.saveChannels
            : copy.profile.save;

  useEffect(() => {
    if (hasManageCommunityChanges) setLastSavedSection(null);
  }, [hasManageCommunityChanges]);

  const deleteManagedChannels = async (
    currentCommunity: Community,
  ): Promise<Community> => {
    let updatedCommunity = currentCommunity;

    for (const channelId of deletedChannelIds) {
      updatedCommunity = await applicationContainer.communities.deleteChannel(
        session,
        community.id,
        channelId,
      );
    }

    return updatedCommunity;
  };

  const createManagedChannel = async (
    channel: ManagedCommunityChannel,
    nextName: string,
  ): Promise<CommunityChannel> => {
    if (channel.type === 'text') {
      return await applicationContainer.communities.createTextChannel(
        session,
        community.id,
        nextName,
      );
    }

    return await applicationContainer.communities.createVoiceChannel(
      session,
      community.id,
      nextName,
    );
  };

  const updateManagedChannelPermissions = async (
    draftChannel: ManagedCommunityChannel,
    savedChannel: CommunityChannel,
    visibleRoleIds: string[],
  ): Promise<CommunityChannel> => {
    if (
      !ManagedCommunityChannels.hasVisibleRoleChanges(
        draftChannel,
        channelDraftInput,
      )
    ) {
      return savedChannel;
    }

    return await applicationContainer.communities.updateChannelPermissions(
      session,
      community.id,
      savedChannel.id,
      visibleRoleIds,
    );
  };

  const saveManagedChannel = async (
    channel: ManagedCommunityChannel,
  ): Promise<CommunityChannel> => {
    const nextName = ManagedCommunityChannels.nameFor(
      channel,
      channelDraftInput,
    );
    const nextVisibleRoleIds = ManagedCommunityChannels.visibleRoleIdsFor(
      channel,
      channelDraftInput,
    );
    const savedChannel = channel.pending
      ? await createManagedChannel(channel, nextName)
      : nextName !== channel.name
        ? await applicationContainer.communities.renameChannel(
            session,
            community.id,
            channel.id,
            nextName,
          )
        : channel;

    return await updateManagedChannelPermissions(
      channel,
      savedChannel,
      nextVisibleRoleIds,
    );
  };

  const saveManagedChannels = async (
    currentCommunity: Community,
  ): Promise<{
    channels: CommunityChannel[];
    community: Community;
  }> => {
    const updatedCommunity = await deleteManagedChannels(currentCommunity);
    const deletedChannelIdsSet = new Set(deletedChannelIds);
    const savedChannels: CommunityChannel[] = [];

    for (const channel of channelOrder) {
      if (deletedChannelIdsSet.has(channel.id)) continue;

      savedChannels.push(await saveManagedChannel(channel));
    }

    return {
      channels: savedChannels,
      community: updatedCommunity,
    };
  };

  const saveChanges = async (): Promise<boolean> => {
    if (state === 'loading') return false;

    if (ManagedCommunityChannels.hasBlankName(channelDraftInput)) {
      setError(copy.communities.channelError);

      return false;
    }

    setState('loading');
    setError(null);
    try {
      if (!hasProfileChanges && !hasChannelChanges) return true;

      let updatedCommunity = community;

      if (hasProfileChanges) {
        updatedCommunity = await applicationContainer.communities.update(
          session,
          community.id,
          {
            autoJoinEnabled: effectiveAutoJoinEnabled,
            avatar: avatar ?? community.avatar,
            banner: banner ?? community.banner,
            description: description.trim(),
            discoverable,
            name: name.trim(),
          },
        );
      }

      if (!hasChannelChanges) {
        onCommunityUpdated({
          ...community,
          ...updatedCommunity,
          ...CommunityChannels.split(CommunityChannels.all(community)),
        });
        setLastSavedSection('profile');

        return true;
      }

      const savedChannels = await saveManagedChannels(updatedCommunity);
      const savedChannelDrafts = Object.fromEntries(
        savedChannels.channels.map((channel) => [channel.id, channel.name]),
      );
      const savedChannelPermissionDrafts = Object.fromEntries(
        savedChannels.channels.map((channel) => [
          channel.id,
          channel.permissions?.visibleRoleIds ?? ['everyone'],
        ]),
      );

      onCommunityUpdated({
        ...community,
        ...savedChannels.community,
        ...CommunityChannels.split(savedChannels.channels),
      });
      originalChannelIdsRef.current = savedChannels.channels.map(
        (channel) => channel.id,
      );
      setChannelOrder(savedChannels.channels);
      setChannelDrafts(savedChannelDrafts);
      setChannelPermissionDrafts(savedChannelPermissionDrafts);
      setDeletedChannelIds([]);
      setLastSavedSection('channels');

      return true;
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.communities.updateError));

      return false;
    } finally {
      setState('idle');
    }
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
    setPendingChannelDeleteId(null);
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
    <div
      className="app-overlay-scrim fixed inset-0 z-[100] grid place-items-stretch bg-black/60 p-0 backdrop-blur-md sm:place-items-center sm:p-4"
      data-state={transitionState}
    >
      <button
        type="button"
        className="absolute inset-0"
        onClick={close}
        aria-label={copy.dialog.close}
      />
      <section
        className="app-overlay-surface app-safe-area-panel ui-dialog-surface relative z-10 flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden sm:h-[88vh] sm:max-h-[88vh] sm:max-w-5xl"
        data-state={transitionState}
      >
        <DialogHeader title={copy.communities.manage} onClose={close} />
        <CommunityManagementContextHeader community={community} />
        <div className="ui-settings-layout mt-3">
          <CommunitySettingsNavigation
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            sections={sections}
          />
          <div className="ui-settings-content flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="grid gap-5 lg:items-start">
                {activeSection === 'profile' && (
                  <ManageCommunityProfilePanel
                    autoJoinEnabled={autoJoinEnabled}
                    avatarInputRef={avatarInputRef}
                    avatarPreview={avatarPreview}
                    bannerInputRef={bannerInputRef}
                    bannerPreview={bannerPreview}
                    community={community}
                    currentAvatarUrl={currentAvatarUrl}
                    currentBannerUrl={currentBannerUrl}
                    description={description}
                    disabled={state === 'loading'}
                    discoverable={discoverable}
                    name={name}
                    onAutoJoinChange={setAutoJoinEnabled}
                    onDescriptionChange={setDescription}
                    onDiscoverableChange={setDiscoverable}
                    onImageEditorChange={setImageEditor}
                    onNameChange={setName}
                  />
                )}

                {activeSection === 'channels' && (
                  <ManageCommunityChannelsPanel
                    canSave={
                      !!name.trim() &&
                      state !== 'loading' &&
                      hasManageCommunityChanges
                    }
                    channelDrafts={channelDrafts}
                    channelName={channelName}
                    channelOrder={channelOrder}
                    channelPermissionDrafts={channelPermissionDrafts}
                    channelType={channelType}
                    onChannelCreate={() => void createChannel()}
                    onChannelDelete={deleteChannel}
                    onChannelDraftChange={(channelId, value) =>
                      setChannelDrafts((current) => ({
                        ...current,
                        [channelId]: value,
                      }))
                    }
                    onChannelMove={moveChannel}
                    onChannelNameChange={setChannelName}
                    onChannelTypeChange={setChannelType}
                    onPendingChannelDeleteChange={setPendingChannelDeleteId}
                    onRoleToggle={toggleChannelRole}
                    onSave={() => void saveChanges()}
                    pendingChannelDeleteId={pendingChannelDeleteId}
                    roles={roles}
                    saveLabel={activeSectionSaveLabel}
                    state={state}
                  />
                )}
              </div>
              {activeSection === 'roles' && (
                <CommunityRolesPanel
                  editableRoles={editableRoles}
                  onCreateRole={() => void createRole()}
                  onDeleteRole={(role) => void deleteRole(role)}
                  onRoleNameChange={setRoleName}
                  onRolePermissionToggle={togglePermission}
                  onRoleSelect={setSelectedRoleId}
                  onUpdateRole={() => void updateRole()}
                  roleName={roleName}
                  rolePermissions={rolePermissions}
                  roleMemberCounts={roleMemberCounts}
                  roles={roles}
                  selectedRole={selectedRole}
                  state={state}
                />
              )}
              {activeSection === 'members' && (
                <CommunityMembersRolesPanel
                  bannedMemberIds={community.bannedMemberIds ?? []}
                  canBanMembers={canBanMembers}
                  canKickMembers={canManageMembers}
                  canManageRoles={canManageRoles}
                  editableRoles={editableRoles}
                  memberIdentities={memberIdentities}
                  memberIds={community.memberIds}
                  memberPictures={memberPictures}
                  memberRoleDrafts={memberRoleDrafts}
                  onBan={(identityId) => void banMember(identityId)}
                  onKick={(identityId) => void kickMember(identityId)}
                  onToggleMemberRole={(identityId, roleId) =>
                    void toggleMemberRole(identityId, roleId)
                  }
                  ownerIdentityId={community.ownerIdentityId}
                  state={state}
                />
              )}
              {activeSection === 'banned-members' && (
                <CommunityBannedMembersPanel
                  bannedMemberIds={community.bannedMemberIds ?? []}
                  onUnban={(identityId) => void unbanMember(identityId)}
                  state={state}
                />
              )}
              {activeSection === 'invitations' && (
                <CommunityInvitationsPanel
                  canApproveRequests={canApproveRequests}
                  canCreateInvitations={canCreateInvitations}
                  canRejectRequests={canRejectRequests}
                  community={community}
                  identityInput={inviteIdentityInput}
                  identityLookup={memberIdentities}
                  onAccept={(requestId) =>
                    void updateMembershipRequest(requestId, 'accepted')
                  }
                  onDecline={(requestId) =>
                    void updateMembershipRequest(requestId, 'declined')
                  }
                  onIdentityInputChange={setInviteIdentityInput}
                  onInvite={() => void inviteMember()}
                  requests={membershipRequests}
                  state={state}
                />
              )}
              {activeSection === 'moderation-logs' && (
                <CommunityModerationLogsPanel
                  community={community}
                  identityLookup={memberIdentities}
                  loading={state === 'loading'}
                  logs={moderationLogs}
                  nextBeforeLogId={nextModerationLogId}
                  onLoadMore={() => void loadMoreModerationLogs()}
                  roles={roles}
                />
              )}
              {error && (
                <div className="ui-inline-notice mt-4 border-rose-300/50 bg-rose-500/10 text-rose-100">
                  {error}
                </div>
              )}
            </div>
            {activeSection === 'profile' && (
              <div className="mt-4 grid gap-2">
                <div className="min-h-4 text-right text-[0.7rem] font-black uppercase tracking-[0.14em] text-white/35">
                  {lastSavedSection === activeSection
                    ? copy.communities.saved
                    : hasManageCommunityChanges
                      ? copy.communities.unsavedChanges
                      : ''}
                </div>
                <button
                  type="button"
                  onClick={() => void saveChanges()}
                  disabled={
                    !name.trim() ||
                    state === 'loading' ||
                    !hasManageCommunityChanges
                  }
                  className="ui-button justify-self-end"
                >
                  {activeSectionSaveLabel}
                </button>
              </div>
            )}
          </div>
        </div>
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

function CommunityManagementContextHeader({
  community,
}: {
  community: Community;
}) {
  return (
    <div className="mx-5 mt-3 flex items-center gap-3 border-b border-white/10 pb-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-sm font-black text-slate-950">
        {community.name.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0">
        <div className="truncate text-sm font-black text-white">
          {community.name}
        </div>
        <div className="truncate text-xs font-semibold text-white/45">
          {copy.communities.network} · {shortId(community.networkId)}
        </div>
      </div>
    </div>
  );
}

function draftChannelId(): string {
  return `draft:${UUID.generate().toString()}`;
}

function toggleRoleId(roleIds: string[], roleId: string): string[] {
  return roleIds.includes(roleId)
    ? roleIds.filter((candidate) => candidate !== roleId)
    : [...roleIds, roleId];
}
