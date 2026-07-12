import type { PublishMessageAttachmentsMessage } from '../../contexts/attachments/application/publish-message-attachments/messages/PublishMessageAttachmentsMessage';
import type { ListCallsMessage } from '../../contexts/calls/application/list-calls/messages/ListCallsMessage';
import type { ListCommunitiesMessage } from '../../contexts/communities/application/list-communities/messages/ListCommunitiesMessage';
import type { ListStickerPacksMessage } from '../../contexts/stickers/application/list-sticker-packs/messages/ListStickerPacksMessage';

import { PigeonAttachmentsApplication } from '../../contexts/attachments/application/PigeonAttachmentsApplication';
import { PigeonCallsApplication } from '../../contexts/calls/application/PigeonCallsApplication';
import { PigeonCommunitiesApplication } from '../../contexts/communities/application/PigeonCommunitiesApplication';
import { PigeonConversationsApplication } from '../../contexts/conversations/application/PigeonConversationsApplication';
import { PigeonIdentitiesApplication } from '../../contexts/identities/application/PigeonIdentitiesApplication';
import { PigeonSessionApplication } from '../../contexts/identities/application/PigeonSessionApplication';
import { PigeonMessagesApplication } from '../../contexts/messages/application/PigeonMessagesApplication';
import { PigeonNetworksApplication } from '../../contexts/networks/application/PigeonNetworksApplication';
import { PigeonNotificationsApplication } from '../../contexts/notifications/application/PigeonNotificationsApplication';
import { PigeonConversationInvitationKeyDecryptor } from '../../contexts/notifications/infrastructure/crypto/PigeonConversationInvitationKeyDecryptor';
import { PigeonPollsApplication } from '../../contexts/polls/application/PigeonPollsApplication';
import { PigeonStickersApplication } from '../../contexts/stickers/application/PigeonStickersApplication';
import { RealtimeGateway } from '../../shared/infrastructure/realtime/RealtimeGateway';
import { PigeonApiGateway } from './PigeonApiGateway';
import { PigeonRealtimeApplication } from './PigeonRealtimeApplication';

export class PigeonApplication {
  public readonly attachments: PigeonAttachmentsApplication;

  public readonly calls: PigeonCallsApplication;

  public readonly communities: PigeonCommunitiesApplication;

  public readonly conversations: PigeonConversationsApplication;

  public readonly identities: PigeonIdentitiesApplication;

  public readonly messages: PigeonMessagesApplication;

  public readonly networks: PigeonNetworksApplication;

  public readonly notifications: PigeonNotificationsApplication;

  public readonly polls: PigeonPollsApplication;

  public readonly realtime: PigeonRealtimeApplication;

  public readonly session: PigeonSessionApplication;

  public readonly stickers: PigeonStickersApplication;

  public constructor(
    gateway: PigeonApiGateway = new PigeonApiGateway(),
    realtime: RealtimeGateway = new RealtimeGateway(),
  ) {
    this.attachments = new PigeonAttachmentsApplication({
      downloadAttachment: gateway,
      getPublicFile: gateway,
      publishMessageAttachments: {
        publish: async (message: PublishMessageAttachmentsMessage) =>
          await gateway.publishMessageAttachments(
            message.getSession(),
            message.getAttachments(),
            message.getProgressReporter(),
            message.getOptions(),
          ),
      },
      uploadPublicFile: gateway,
    });
    this.calls = new PigeonCallsApplication({
      endCall: gateway.calls,
      getCall: gateway.calls,
      getIceServers: gateway.calls,
      heartbeatParticipant: gateway.calls,
      joinCall: gateway.calls,
      leaveCall: gateway.calls,
      listCalls: {
        list: async (message: ListCallsMessage) =>
          await gateway.calls.list(message.getSession()),
      },
      sendCallSignal: gateway.calls,
      startCommunityChannelCall: gateway.calls,
      startConversationCall: gateway.calls,
    });
    this.communities = new PigeonCommunitiesApplication({
      channelDrafts: gateway.communityGateway,
      channelMessages: gateway.communityGateway,
      channelPins: gateway.communityGateway,
      channelReads: gateway.communityGateway,
      channels: gateway.communityGateway,
      communityCreator: gateway.communityGateway,
      communityDiscoverer: gateway.communityGateway,
      communityGetter: gateway.communityGateway,
      communityInvitationCreator: gateway.communityGateway,
      communityInviteLinkAcceptor: gateway.communityGateway,
      communityInviteLinkAcceptorWithKey: gateway.communityGateway,
      communityInviteLinkCreator: gateway.communityGateway,
      communityInviteLinkGetter: gateway.communityGateway,
      communityUpdater: gateway.communityGateway,
      keychain: gateway,
      leaveCommunity: gateway.communityGateway,
      listCommunities: {
        list: async (message: ListCommunitiesMessage) =>
          await gateway.communityGateway.listCommunities(message.getSession()),
      },
      media: gateway.communityGateway,
      members: gateway.communityGateway,
      membershipRequests: gateway.communityGateway,
      moderationLogs: gateway.communityGateway,
      roles: gateway.communityGateway,
    });
    this.conversations = new PigeonConversationsApplication({
      createConversation: gateway.conversationsGateway,
      createGroupConversation: gateway.conversationsGateway,
      inviteToGroupConversation: gateway.conversationsGateway,
      listConversations: {
        listConversations: gateway.conversationsGateway.listConversations.bind(
          gateway.conversationsGateway,
        ),
        loadMessages: gateway.messagesGateway.loadMessages.bind(
          gateway.messagesGateway,
        ),
      },
      markConversationReadUntil: gateway.conversationsGateway,
    });
    this.identities = new PigeonIdentitiesApplication({
      keychain: gateway.identityGateway,
      login: gateway.identityGateway,
      presence: gateway.identityGateway,
      profile: gateway.identityGateway,
      protection: gateway.identityGateway,
      register: gateway.identityGateway,
    });
    this.messages = new PigeonMessagesApplication({
      addMessageReaction: gateway.messagesGateway,
      createLinkPreview: gateway.messagesGateway,
      decryptMessage: gateway.messagesGateway,
      deleteConversationDraft: gateway.messagesGateway,
      deleteMessage: gateway.messagesGateway,
      editMessage: gateway.messagesGateway,
      listConversationDrafts: gateway.messagesGateway,
      listMessagePins: gateway.messagesGateway,
      loadMessage: gateway.messagesGateway,
      loadMessages: gateway.messagesGateway,
      loadMessagesAround: gateway.messagesGateway,
      loadMessageThread: gateway.messagesGateway,
      pinMessage: gateway.messagesGateway,
      removeMessageReaction: gateway.messagesGateway,
      saveConversationDraft: gateway.messagesGateway,
      sendMessage: gateway.messagesGateway,
      unpinMessage: gateway.messagesGateway,
    });
    this.networks = new PigeonNetworksApplication({
      checkRelayPorts: gateway.node,
      claimNode: gateway.node,
      createNetwork: {
        create: async (name) =>
          await gateway.node.createNetwork(name.toString()),
      },
      createNetworkForNode: gateway.node,
      createPublicNetwork: {
        createPublic: async (session) =>
          await gateway.node.createPublicNetwork(session),
      },
      getNodeInfo: gateway.node,
      getRelayConfiguration: gateway.node,
      getReplicationStatus: gateway.node,
      joinNetwork: {
        joinNetwork: async (id, name, key) =>
          await gateway.node.joinNetwork(
            id.toString(),
            name.toString(),
            key.toString(),
          ),
      },
      joinNetworkForNode: gateway.node,
      listNodeNetworks: {
        getNodeNetworks: async (session) =>
          await gateway.node.getNetworks(session),
      },
      listPeers: gateway.node,
      removeNodeNetwork: {
        remove: async (networkId, session) =>
          await gateway.node.removeNetwork(networkId.toString(), session),
      },
      updateRelayConfiguration: gateway.node,
    });
    this.notifications = new PigeonNotificationsApplication({
      acceptInvitation: {
        keychainPublisher: gateway.identityGateway,
        keyDecryptor: new PigeonConversationInvitationKeyDecryptor(),
        notifications: gateway.notificationsGateway,
      },
      listNotifications: gateway.notificationsGateway,
      listNotificationSettings: gateway.notificationsGateway,
      push: gateway.pushGateway,
      resetNotificationSetting: gateway.notificationsGateway,
      saveNotificationSetting: gateway.notificationsGateway,
      updateNotification: gateway.notificationsGateway,
    });
    this.polls = new PigeonPollsApplication({
      closePoll: gateway,
      createPoll: gateway,
      getPoll: gateway,
      removePollVote: gateway,
      votePoll: {
        vote: async (message) =>
          await gateway.votePoll(
            message.getSession(),
            message.getPollId().toString(),
            message.getOptionIds().map((optionId) => optionId.toString()),
          ),
      },
    });
    this.realtime = new PigeonRealtimeApplication(realtime);
    this.session = new PigeonSessionApplication(gateway.identityGateway);
    this.stickers = new PigeonStickersApplication({
      addStickerToPack: {
        addStickerToPack: gateway.stickersGateway.addSticker.bind(
          gateway.stickersGateway,
        ),
      },
      assetUrl: gateway,
      createStickerPack: {
        createStickerPack: gateway.stickersGateway.createPack.bind(
          gateway.stickersGateway,
        ),
      },
      deleteSticker: gateway.stickersGateway,
      favoriteSticker: gateway.stickersGateway,
      getMyStickers: gateway.stickersGateway,
      getStickerPack: {
        getStickerPack: gateway.stickersGateway.getPack.bind(
          gateway.stickersGateway,
        ),
      },
      listStickerPacks: {
        list: async (message: ListStickerPacksMessage) =>
          await gateway.stickersGateway.listPacks({
            ownerIdentityId: message.getOwnerIdentityId(),
          }),
      },
      markStickerUsed: {
        markStickerUsed: gateway.stickersGateway.markUsed.bind(
          gateway.stickersGateway,
        ),
      },
      saveStickerPack: {
        saveStickerPack: gateway.stickersGateway.savePack.bind(
          gateway.stickersGateway,
        ),
      },
      unfavoriteSticker: gateway.stickersGateway,
      unsaveStickerPack: {
        unsaveStickerPack: gateway.stickersGateway.unsavePack.bind(
          gateway.stickersGateway,
        ),
      },
      updateSticker: gateway.stickersGateway,
      updateStickerPack: {
        updateStickerPack: gateway.stickersGateway.updatePack.bind(
          gateway.stickersGateway,
        ),
      },
      uploadStickerAsset: {
        uploadStickerAsset: gateway.stickersGateway.uploadAsset.bind(
          gateway.stickersGateway,
        ),
      },
    });
  }
}
