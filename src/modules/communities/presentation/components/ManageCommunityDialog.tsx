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
import { CommunityChannels } from '../../domain/CommunityChannels';
import { CommunityAccessPolicy } from '../../domain/CommunityAccessPolicy';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { CommunityBannedMembersPanel } from './CommunityBannedMembersPanel';
import { CommunityInvitationsPanel } from './CommunityInvitationsPanel';
import {
  DialogHeader,
  TrashIcon,
  VoiceIcon,
} from './communityDialogPrimitives';
import { loadIdentityPicture, loadPublicImage } from './communityImages';
import { CommunityMembersRolesPanel } from './CommunityMembersRolesPanel';
import { CommunityModerationLogsPanel } from './CommunityModerationLogsPanel';
import { CommunityRolesPanel } from './CommunityRolesPanel';
import { CommunityPublicSettingsPanel } from './CommunityPublicSettingsPanel';
import {
  ManagedCommunityChannels,
  type ManagedCommunityChannel,
} from './ManagedCommunityChannels';
import {
  CommunitySettingsNavigation,
  type CommunitySettingsSection,
} from './communitySettingsNavigation';

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
  useCloseOnEscape(onClose);

  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [autoJoinEnabled, setAutoJoinEnabled] = useState(
    community.autoJoinEnabled ?? false,
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
              : await applicationContainer.getIdentity(
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
              : await applicationContainer.getIdentity(
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
  const bannedMemberIds = new Set(community.bannedMemberIds ?? []);

  const refreshCommunity = async () => {
    const freshCommunity = await applicationContainer.getCommunity(
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
      await applicationContainer.assignCommunityMemberRoles(
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
      const role = await applicationContainer.createCommunityRole(
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
      await applicationContainer.updateCommunityRole(
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
      await applicationContainer.deleteCommunityRole(
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
      await applicationContainer.banCommunityMember(
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
        await applicationContainer.listCommunityMembershipRequests(session);

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
      const page = await applicationContainer.listCommunityModerationLogs(
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
      const page = await applicationContainer.listCommunityModerationLogs(
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
      const request = await applicationContainer.addCommunityMember(
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
        await applicationContainer.updateCommunityMembershipRequest(
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
      await applicationContainer.kickCommunityMember(
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
      await applicationContainer.unbanCommunityMember(
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
  const hasProfileChanges =
    avatar !== null ||
    banner !== null ||
    name.trim() !== community.name ||
    autoJoinEnabled !== (community.autoJoinEnabled ?? false) ||
    description.trim() !== community.description ||
    discoverable !== (community.discoverable ?? true);
  const hasChannelChanges = ManagedCommunityChannels.hasChanges(
    channelDraftInput,
  );
  const hasManageCommunityChanges = hasProfileChanges || hasChannelChanges;
  const activeSectionHasChanges =
    activeSection === 'profile'
      ? hasProfileChanges
      : activeSection === 'channels'
        ? hasChannelChanges
        : false;
  const activeSectionHasExternalChanges =
    activeSection === 'profile'
      ? hasChannelChanges
      : activeSection === 'channels'
        ? hasProfileChanges
        : hasManageCommunityChanges;

  useEffect(() => {
    if (hasManageCommunityChanges) setLastSavedSection(null);
  }, [hasManageCommunityChanges]);

  const saveManagedChannels = async (
    currentCommunity: Community,
  ): Promise<{
    channels: CommunityChannel[];
    community: Community;
  }> => {
    let updatedCommunity = currentCommunity;

    for (const channelId of deletedChannelIds) {
      updatedCommunity = await applicationContainer.deleteCommunityChannel(
        session,
        community.id,
        channelId,
      );
    }

    for (const channel of channelOrder) {
      const nextName = ManagedCommunityChannels.nameFor(
        channel,
        channelDraftInput,
      );

      if (channel.pending) {
        if (channel.type === 'text') {
          await applicationContainer.createCommunityTextChannel(
            session,
            community.id,
            nextName,
          );
        } else {
          await applicationContainer.createCommunityVoiceChannel(
            session,
            community.id,
            nextName,
          );
        }
      } else if (nextName !== channel.name) {
        await applicationContainer.renameCommunityChannel(
          session,
          community.id,
          channel.id,
          nextName,
        );
      }

      if (
        !channel.pending &&
        ManagedCommunityChannels.hasVisibleRoleChanges(
          channel,
          channelDraftInput,
        )
      ) {
        await applicationContainer.updateCommunityChannelPermissions(
          session,
          community.id,
          channel.id,
          ManagedCommunityChannels.visibleRoleIdsFor(
            channel,
            channelDraftInput,
          ),
        );
      }
    }

    return {
      channels: ManagedCommunityChannels.orderSavedChannels(
        await applicationContainer.listCommunityChannels(session, community.id),
        channelDraftInput,
      ),
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
        updatedCommunity = await applicationContainer.updateCommunity(
          session,
          community.id,
          {
            autoJoinEnabled,
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
    <div className="fixed inset-0 z-[100] grid place-items-stretch bg-black/60 p-0 backdrop-blur-md sm:place-items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <section className="glass-panel-strong relative z-10 flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden rounded-none p-5 shadow-2xl shadow-black/40 sm:h-[88vh] sm:max-h-[88vh] sm:max-w-5xl sm:rounded-2xl">
        <DialogHeader title={copy.communities.manage} onClose={onClose} />
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden sm:grid sm:grid-cols-[220px_minmax(0,1fr)]">
          <CommunitySettingsNavigation
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            sections={sections}
          />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
                          onChange={(event) =>
                            setDescription(event.target.value)
                          }
                          className="min-h-20 w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                        />
                        <CommunityPublicSettingsPanel
                          autoJoinEnabled={autoJoinEnabled}
                          discoverable={discoverable}
                          disabled={state === 'loading'}
                          framed={false}
                          onAutoJoinChange={setAutoJoinEnabled}
                          onDiscoverableChange={setDiscoverable}
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
                    <div className="max-h-[34vh] space-y-3 overflow-y-auto pr-1 sm:max-h-[48vh]">
                      {channelOrder.map((channel, index) => (
                        <div
                          key={channel.id}
                          className="rounded-2xl border border-white/10 bg-white/8 p-3"
                        >
                          <div className="flex items-start gap-3">
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-white/65">
                              {channel.type === 'voice' ? <VoiceIcon /> : '#'}
                            </span>
                            <div className="min-w-0 flex-1 space-y-2">
                              <input
                                value={
                                  channelDrafts[channel.id] ?? channel.name
                                }
                                onChange={(event) =>
                                  setChannelDrafts((current) => ({
                                    ...current,
                                    [channel.id]: event.target.value,
                                  }))
                                }
                                className="h-10 w-full min-w-0 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm font-bold text-white outline-none focus:border-cyan-300/60"
                              />
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-black/25 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-white/40">
                                  {channel.type === 'voice'
                                    ? copy.communities.voiceChannel
                                    : copy.communities.textChannel}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => moveChannel(channel.id, -1)}
                                  disabled={index === 0}
                                  className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 font-black transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
                                  aria-label={copy.communities.moveChannelUp}
                                  title={copy.communities.moveChannelUp}
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveChannel(channel.id, 1)}
                                  disabled={index === channelOrder.length - 1}
                                  className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 font-black transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
                                  aria-label={
                                    copy.communities.moveChannelDown
                                  }
                                  title={copy.communities.moveChannelDown}
                                >
                                  ↓
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPendingChannelDeleteId(channel.id)
                                  }
                                  disabled={state === 'loading'}
                                  className="grid h-9 w-9 place-items-center rounded-xl bg-rose-500/15 text-rose-100 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-35"
                                  aria-label={copy.communities.deleteChannel}
                                  title={copy.communities.deleteChannel}
                                >
                                  <TrashIcon />
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 rounded-2xl bg-black/20 p-3">
                            <div className="mb-2 text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/35">
                              {copy.communities.visibleRoles}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {roles
                                .filter((role) => role.id === 'everyone')
                                .map((role) => {
                                  const selected = (
                                    channelPermissionDrafts[channel.id] ?? [
                                      'everyone',
                                    ]
                                  ).includes(role.id);

                                  return (
                                    <label
                                      key={`${channel.id}:${role.id}`}
                                      className={cx(
                                        'inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition',
                                        selected
                                          ? 'border-cyan-200/70 bg-cyan-200 text-slate-950'
                                          : 'border-white/10 bg-white/8 text-white/70 hover:bg-white/12 hover:text-white',
                                      )}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selected}
                                        onChange={() =>
                                          toggleChannelRole(channel.id, role.id)
                                        }
                                        className="sr-only"
                                      />
                                      <span
                                        aria-hidden="true"
                                        className={cx(
                                          'grid h-4 w-4 place-items-center rounded border text-[0.6rem]',
                                          selected
                                            ? 'border-slate-950 bg-slate-950 text-white'
                                            : 'border-white/35',
                                        )}
                                      >
                                        {selected ? '✓' : ''}
                                      </span>
                                      {copy.communities.visibleToEveryone}
                                    </label>
                                  );
                                })}
                              {roles.some((role) => role.id !== 'everyone') && (
                                <div className="mt-1 w-full border-t border-white/10 pt-3">
                                  <div className="mb-2 text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/35">
                                    {copy.communities.visibleToSelectedRoles}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {roles
                                      .filter((role) => role.id !== 'everyone')
                                      .map((role) => {
                                        const selected = (
                                          channelPermissionDrafts[channel.id] ??
                                          ['everyone']
                                        ).includes(role.id);

                                        return (
                                          <label
                                            key={`${channel.id}:${role.id}`}
                                            className={cx(
                                              'inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition',
                                              selected
                                                ? 'border-cyan-200/70 bg-cyan-200 text-slate-950'
                                                : 'border-white/10 bg-white/8 text-white/70 hover:bg-white/12 hover:text-white',
                                            )}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={selected}
                                              onChange={() =>
                                                toggleChannelRole(
                                                  channel.id,
                                                  role.id,
                                                )
                                              }
                                              className="sr-only"
                                            />
                                            <span
                                              aria-hidden="true"
                                              className={cx(
                                                'grid h-4 w-4 place-items-center rounded border text-[0.6rem]',
                                                selected
                                                  ? 'border-slate-950 bg-slate-950 text-white'
                                                  : 'border-white/35',
                                              )}
                                            >
                                              {selected ? '✓' : ''}
                                            </span>
                                            {role.name}
                                          </label>
                                        );
                                      })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          {pendingChannelDeleteId === channel.id && (
                            <div className="mt-3 rounded-2xl border border-rose-300/20 bg-rose-500/10 p-3">
                              <div className="text-xs font-bold text-rose-50/85">
                                {copy.communities.deleteChannelConfirm}
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => deleteChannel(channel)}
                                  disabled={state === 'loading'}
                                  className="rounded-xl bg-rose-100 px-3 py-2 text-xs font-black text-rose-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                  {copy.communities.confirmDeleteChannel}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPendingChannelDeleteId(null)}
                                  className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white/15"
                                >
                                  {copy.dialog.cancel}
                                </button>
                              </div>
                            </div>
                          )}
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
                        className="grid h-11 w-12 shrink-0 place-items-center rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45"
                        aria-label={copy.communities.addInitialChannel}
                      >
                        +
                      </button>
                    </div>
                  </div>
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
                <div className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-3 text-xs text-rose-100">
                  {error}
                </div>
              )}
            </div>
            {(activeSection === 'profile' || activeSection === 'channels') && (
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
                  className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {state === 'loading'
                    ? copy.profile.saving
                    : lastSavedSection === activeSection
                      ? copy.communities.saved
                      : activeSectionHasExternalChanges
                        ? copy.communities.saveChanges
                        : activeSection === 'channels'
                          ? copy.communities.saveChannels
                          : copy.profile.save}
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
function draftChannelId(): string {
  return `draft:${UUID.generate().toString()}`;
}

function toggleRoleId(roleIds: string[], roleId: string): string[] {
  return roleIds.includes(roleId)
    ? roleIds.filter((candidate) => candidate !== roleId)
    : [...roleIds, roleId];
}
