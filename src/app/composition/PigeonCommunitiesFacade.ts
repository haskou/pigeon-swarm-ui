import { CommunityInvitationKey } from '@haskou/pigeon-swarm-crypto';

import type { CommunityChannelMessageEditInput } from '../../contexts/communities/infrastructure/http/CommunityChannelMessageEditInput';
import type { CommunityChannelMessageInput } from '../../contexts/communities/infrastructure/http/CommunityChannelMessageInput';
import type { CommunityChannelDraft } from '../../contexts/communities/infrastructure/http/resources/CommunityChannelDraft';
import type { CommunityChannelResource as CommunityChannel } from '../../contexts/communities/infrastructure/http/resources/CommunityChannelResource';
import type { CommunityDiscoveryResource } from '../../contexts/communities/infrastructure/http/resources/CommunityDiscoveryResource';
import type { CommunityInvitationPreviewResource } from '../../contexts/communities/infrastructure/http/resources/CommunityInvitationPreviewResource';
import type { CommunityInvitationResource } from '../../contexts/communities/infrastructure/http/resources/CommunityInvitationResource';
import type { CommunityMembershipRequestResource as CommunityMembershipRequest } from '../../contexts/communities/infrastructure/http/resources/CommunityMembershipRequestResource';
import type { CommunityModerationLogPageResource as CommunityModerationLogPage } from '../../contexts/communities/infrastructure/http/resources/CommunityModerationLogPageResource';
import type { CommunityPermissionResource as CommunityPermission } from '../../contexts/communities/infrastructure/http/resources/CommunityPermissionResource';
import type { CommunityResource as Community } from '../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { CommunityRoleResource } from '../../contexts/communities/infrastructure/http/resources/CommunityRoleResource';
import type { CommunityTextChannelResource as CommunityTextChannel } from '../../contexts/communities/infrastructure/http/resources/CommunityTextChannelResource';
import type { CommunityVoiceChannelResource as CommunityVoiceChannel } from '../../contexts/communities/infrastructure/http/resources/CommunityVoiceChannelResource';
import type { Session } from '../../contexts/identities/infrastructure/session/Session';
import type { CommunityChannelMessagePinsResource } from '../../contexts/messages/infrastructure/http/CommunityChannelMessagePinsResource';
import type { MessageResource } from '../../contexts/messages/infrastructure/http/MessageResource';
import type { CreateCommunityInput } from './communities/create-community/CreateCommunityInput';
import type { LeaveCommunityResult } from './communities/create-community/LeaveCommunityResult';
import type { PigeonMlsFacade } from './mls/PigeonMlsFacade';

import { PigeonCommunitiesGateway } from '../../contexts/communities/infrastructure/http/PigeonCommunitiesGateway';
import { PigeonIdentitiesGateway } from '../../contexts/identities/infrastructure/http/PigeonIdentitiesGateway';
import { CreateCommunity } from './communities/create-community/CreateCommunity';
import { LeaveCommunity } from './communities/leave-community/LeaveCommunity';
import { PigeonCommunityManagement } from './communities/PigeonCommunityManagement';

export class PigeonCommunitiesFacade {
  private readonly channelDrafts: PigeonCommunitiesGateway;

  private readonly channelMessages: PigeonCommunitiesGateway;

  private readonly channelPins: PigeonCommunitiesGateway;

  private readonly channels: PigeonCommunitiesGateway;

  private readonly channelReads: PigeonCommunitiesGateway;

  private readonly createCommunityUseCase: CreateCommunity;

  private readonly communityDiscoverer: PigeonCommunitiesGateway;

  private readonly communityGetter: PigeonCommunitiesGateway;

  private readonly communityUpdater: PigeonCommunitiesGateway;

  private readonly communityInvitations: PigeonCommunitiesGateway;

  private readonly keychain: PigeonIdentitiesGateway;

  private readonly leaveCommunityUseCase: LeaveCommunity;

  private readonly media: PigeonCommunitiesGateway;

  private readonly mls: PigeonMlsFacade;

  private readonly management: PigeonCommunityManagement;

  private readonly moderationLogs: PigeonCommunitiesGateway;

  private readonly members: PigeonCommunitiesGateway;

  private readonly membershipRequests: PigeonCommunitiesGateway;

  private readonly roles: PigeonCommunitiesGateway;

  public constructor(
    communities: PigeonCommunitiesGateway,
    identities: PigeonIdentitiesGateway,
    mls: PigeonMlsFacade,
    management: PigeonCommunityManagement,
  ) {
    this.channelDrafts = communities;
    this.channelMessages = communities;
    this.channelPins = communities;
    this.channels = communities;
    this.channelReads = communities;
    this.createCommunityUseCase = new CreateCommunity(communities, mls);
    this.communityDiscoverer = communities;
    this.communityGetter = communities;
    this.communityUpdater = communities;
    this.communityInvitations = communities;
    this.keychain = identities;
    this.leaveCommunityUseCase = new LeaveCommunity(communities, identities);
    this.media = communities;
    this.mls = mls;
    this.management = management;
    this.members = communities;
    this.membershipRequests = communities;
    this.moderationLogs = communities;
    this.roles = communities;
  }

  /**
   * Rotates the group keys right away. Failing here must not undo the
   * moderation, since any online member reconciles the group on its next sync.
   */
  private async removeFromGroup(
    session: Session,
    communityId: string,
  ): Promise<void> {
    await this.mls
      .synchronize(session, communityId, { force: true })
      .catch(() => undefined);
  }

  private async resolvePublicImageCid(
    session: Session,
    value: File | null | string | undefined,
  ): Promise<string | undefined> {
    if (!value) return undefined;

    if (typeof value === 'string') return value;

    return (await this.media.uploadPublicFile(session, value)).cid;
  }

  public async list(session: Session): Promise<Community[]> {
    return await this.management.search(session);
  }

  public async get(session: Session, communityId: string): Promise<Community> {
    return await this.management.find(session, communityId);
  }

  public async listModerationLogs(
    session: Session,
    communityId: string,
    input?: { beforeLogId?: string; limit?: number },
  ): Promise<CommunityModerationLogPage> {
    return await this.moderationLogs.listCommunityModerationLogs(
      session,
      communityId,
      input,
    );
  }

  public async discover(
    session: Session,
    input: { networkId?: string; query?: string },
  ): Promise<CommunityDiscoveryResource[]> {
    return await this.communityDiscoverer.discoverCommunities(session, input);
  }

  public async create(
    session: Session,
    input: CreateCommunityInput,
  ): Promise<Community> {
    return await this.createCommunityUseCase.create(session, input);
  }

  public async update(
    session: Session,
    communityId: string,
    input: {
      autoJoinEnabled?: boolean | undefined;
      avatar?: File | null | string;
      banner?: File | null | string;
      description?: string;
      discoverable?: boolean | undefined;
      name?: string;
    },
  ): Promise<Community> {
    const avatarCid = await this.resolvePublicImageCid(session, input.avatar);
    const bannerCid = await this.resolvePublicImageCid(session, input.banner);

    return await this.communityUpdater.updateCommunity(session, communityId, {
      autoJoinEnabled: input.autoJoinEnabled,
      ...(avatarCid ? { avatar: avatarCid } : {}),
      ...(bannerCid ? { banner: bannerCid } : {}),
      description: input.description,
      discoverable: input.discoverable,
      name: input.name,
    });
  }

  public async banMember(
    session: Session,
    communityId: string,
    identityId: string,
  ): Promise<Community> {
    const community = await this.management.banMember(
      session,
      communityId,
      identityId,
    );

    await this.removeFromGroup(session, communityId);

    return community;
  }

  public async unbanMember(
    session: Session,
    communityId: string,
    identityId: string,
  ): Promise<Community> {
    return await this.management.unbanMember(session, communityId, identityId);
  }

  public async kickMember(
    session: Session,
    communityId: string,
    identityId: string,
  ): Promise<Community> {
    const community = await this.management.kickMember(
      session,
      communityId,
      identityId,
    );

    await this.removeFromGroup(session, communityId);

    return community;
  }

  public async createJoinRequest(
    session: Session,
    communityId: string,
    networkId: string,
  ): Promise<CommunityMembershipRequest> {
    return await this.membershipRequests.createCommunityJoinRequest(
      session,
      communityId,
      networkId,
    );
  }

  public async listMembershipRequests(
    session: Session,
  ): Promise<CommunityMembershipRequest[]> {
    return await this.membershipRequests.listCommunityMembershipRequests(
      session,
    );
  }

  public async updateMembershipRequest(
    session: Session,
    requestId: string,
    status: Extract<
      CommunityMembershipRequest['status'],
      'accepted' | 'declined'
    >,
  ): Promise<CommunityMembershipRequest> {
    return await this.membershipRequests.updateCommunityMembershipRequest(
      session,
      requestId,
      status,
    );
  }

  public async leave(
    session: Session,
    communityId: string,
  ): Promise<LeaveCommunityResult> {
    return await this.leaveCommunityUseCase.leave(session, communityId);
  }

  /**
   * Signs an invitation under a fresh secret. The secret is returned to the
   * issuer for the link and goes nowhere else: the node gets only the key.
   */
  public async createInvitation(
    session: Session,
    communityId: string,
    input: { expiresAt: number; invitee?: string; maxUses: number },
  ): Promise<{ invitation: CommunityInvitationResource; secret: string }> {
    const { key, secret } = CommunityInvitationKey.generate();
    const invitation =
      await this.communityInvitations.createCommunityInvitation(
        session,
        communityId,
        {
          expiresAt: input.expiresAt,
          invitationKey: key.publicKey(),
          ...(input.invitee === undefined ? {} : { invitee: input.invitee }),
          maxUses: input.maxUses,
        },
      );

    return { invitation, secret };
  }

  public async listInvitations(
    session: Session,
    communityId: string,
  ): Promise<CommunityInvitationResource[]> {
    return await this.communityInvitations.listCommunityInvitations(
      session,
      communityId,
    );
  }

  public async revokeInvitation(
    session: Session,
    communityId: string,
    invitationId: string,
  ): Promise<void> {
    await this.communityInvitations.revokeCommunityInvitation(
      session,
      communityId,
      invitationId,
    );
  }

  /** What the link holder may see of the community, read with its key. */
  public async previewInvitation(
    communityId: string,
    secret: string,
  ): Promise<CommunityInvitationPreviewResource> {
    return await this.communityInvitations.previewCommunityInvitation(
      communityId,
      CommunityInvitationKey.fromSecret(secret).publicKey(),
    );
  }

  public async claimInvitation(
    session: Session,
    preview: CommunityInvitationPreviewResource,
    secret: string,
  ): Promise<void> {
    await this.communityInvitations.claimCommunityInvitation(
      session,
      preview,
      secret,
    );
  }

  public async listMembers(
    session: Session,
    communityId: string,
  ): Promise<string[]> {
    return await this.members.listCommunityMembers(session, communityId);
  }

  public async listRoles(
    session: Session,
    communityId: string,
  ): Promise<CommunityRoleResource[]> {
    return await this.roles.listCommunityRoles(session, communityId);
  }

  public async createRole(
    session: Session,
    communityId: string,
    input: { name: string; permissions: CommunityPermission[] },
  ): Promise<CommunityRoleResource> {
    return await this.management.createRole(
      session,
      communityId,
      input.name,
      input.permissions,
    );
  }

  public async updateRole(
    session: Session,
    communityId: string,
    roleId: string,
    input: { name: string; permissions: CommunityPermission[] },
  ): Promise<CommunityRoleResource> {
    return await this.management.updateRole(
      session,
      communityId,
      roleId,
      input.name,
      input.permissions,
    );
  }

  public async deleteRole(
    session: Session,
    communityId: string,
    roleId: string,
  ): Promise<void> {
    await this.management.deleteRole(session, communityId, roleId);
  }

  public async assignMemberRoles(
    session: Session,
    communityId: string,
    identityId: string,
    roleIds: string[],
  ): Promise<Community> {
    return await this.management.assignMemberRoles(
      session,
      communityId,
      identityId,
      roleIds,
    );
  }

  public async createTextChannel(
    session: Session,
    communityId: string,
    name: string,
  ): Promise<CommunityTextChannel> {
    return await this.management.createChannel(
      session,
      communityId,
      name,
      'text',
    );
  }

  public async createVoiceChannel(
    session: Session,
    communityId: string,
    name: string,
  ): Promise<CommunityVoiceChannel> {
    return await this.management.createChannel(
      session,
      communityId,
      name,
      'voice',
    );
  }

  public async listChannels(
    session: Session,
    communityId: string,
  ): Promise<CommunityChannel[]> {
    return await this.channels.listCommunityChannels(session, communityId);
  }

  public async renameChannel(
    session: Session,
    communityId: string,
    channelId: string,
    name: string,
  ): Promise<CommunityChannel> {
    return await this.management.renameChannel(
      session,
      communityId,
      channelId,
      name,
    );
  }

  public async deleteChannel(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<Community> {
    return await this.management.deleteChannel(session, communityId, channelId);
  }

  /**
   * In an encrypted community a restricted channel has its own group, which
   * the identity signing the restriction starts: it is refused before signing
   * when that identity could not add the members.
   */
  public async updateChannelPermissions(
    session: Session,
    communityId: string,
    channelId: string,
    visibleRoleIds: string[],
  ): Promise<CommunityChannel> {
    const encrypted =
      (await this.management.find(session, communityId)).visibility !==
      'public';

    if (encrypted) {
      await this.mls.assertCanRestrictChannel(
        session,
        communityId,
        visibleRoleIds,
      );
    }

    const channel = await this.management.updateChannelPermissions(
      session,
      communityId,
      channelId,
      visibleRoleIds,
    );

    if (encrypted) {
      await this.mls.openChannelGroup(session, communityId, channelId);
    }

    return channel;
  }

  public async createChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    input: CommunityChannelMessageInput,
  ): Promise<MessageResource> {
    return await this.channelMessages.createCommunityChannelMessage(
      session,
      communityId,
      channelId,
      input,
    );
  }

  public async listChannelMessages(
    session: Session,
    communityId: string,
    channelId: string,
    options: { beforeMessageId?: string; limit?: number } = {},
  ): Promise<{
    messages: MessageResource[];
    nextBeforeMessageId?: null | string;
  }> {
    return await this.channelReads.listCommunityChannelMessages(
      session,
      communityId,
      channelId,
      options,
    );
  }

  public async listChannelMessageThread(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
    options: { limit?: number } = {},
  ): Promise<{
    messages: MessageResource[];
    nextBeforeMessageId?: null | string;
  }> {
    return await this.channelReads.listCommunityChannelMessageThread(
      session,
      communityId,
      channelId,
      messageId,
      options,
    );
  }

  public async listChannelMessagePins(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<CommunityChannelMessagePinsResource> {
    return await this.channelReads.listCommunityChannelMessagePins(
      session,
      communityId,
      channelId,
    );
  }

  public async pinChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
  ): Promise<void> {
    await this.channelPins.pinCommunityChannelMessage(
      session,
      communityId,
      channelId,
      messageId,
    );
  }

  public async unpinChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
  ): Promise<void> {
    await this.channelPins.unpinCommunityChannelMessage(
      session,
      communityId,
      channelId,
      messageId,
    );
  }

  public async listDrafts(session: Session): Promise<CommunityChannelDraft[]> {
    return await this.channelReads.listCommunityDrafts(session);
  }

  public async saveChannelDraft(
    session: Session,
    communityId: string,
    channelId: string,
    content: string,
    updatedAt = Date.now(),
  ): Promise<CommunityChannelDraft> {
    return await this.channelDrafts.saveCommunityChannelDraft(
      session,
      communityId,
      channelId,
      content,
      updatedAt,
    );
  }

  public async deleteChannelDraft(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<void> {
    await this.channelDrafts.deleteCommunityChannelDraft(
      session,
      communityId,
      channelId,
    );
  }

  public async searchChannelMessages(
    session: Session,
    communityId: string,
    channelId: string,
    input: { limit?: number; query: string },
  ): Promise<{
    channelId?: string;
    messages: MessageResource[];
    nextBeforeMessageId?: null | string;
  }> {
    return await this.channelReads.searchCommunityChannelMessages(
      session,
      communityId,
      channelId,
      input,
    );
  }

  public async searchMessages(
    session: Session,
    communityId: string,
    input: { limit?: number; query: string },
  ): Promise<{
    channelId?: string;
    messages: MessageResource[];
    nextBeforeMessageId?: null | string;
  }> {
    return await this.channelReads.searchCommunityMessages(
      session,
      communityId,
      input,
    );
  }

  public async deleteChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
    authorIdentityId: string,
  ): Promise<void> {
    await this.channelMessages.deleteCommunityChannelMessage(
      session,
      communityId,
      channelId,
      messageId,
      authorIdentityId,
    );
  }

  public async editChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
    input: CommunityChannelMessageEditInput,
  ): Promise<MessageResource> {
    return await this.channelMessages.editCommunityChannelMessage(
      session,
      communityId,
      channelId,
      messageId,
      input,
    );
  }

  public async addChannelMessageReaction(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.channelMessages.addCommunityChannelMessageReaction(
      session,
      communityId,
      channelId,
      messageId,
      emoji,
    );
  }

  public async removeChannelMessageReaction(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.channelMessages.removeCommunityChannelMessageReaction(
      session,
      communityId,
      channelId,
      messageId,
      emoji,
    );
  }
}
