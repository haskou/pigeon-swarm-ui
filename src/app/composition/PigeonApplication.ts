import type { PublishMessageAttachmentsMessage } from '../../contexts/attachments/application/publish-message-attachments/messages/PublishMessageAttachmentsMessage';
import type { ListCallsMessage } from '../../contexts/calls/application/list-calls/messages/ListCallsMessage';
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
      channels: gateway,
      directory: gateway,
      invitations: gateway,
      keychain: gateway,
      media: gateway,
      membership: gateway,
      roles: gateway,
    });
    this.conversations = new PigeonConversationsApplication({
      createConversation: gateway,
      createGroupConversation: gateway,
      inviteToGroupConversation: gateway,
      listConversations: gateway,
      markConversationReadUntil: gateway,
    });
    this.identities = new PigeonIdentitiesApplication({
      keychain: gateway,
      login: gateway,
      presence: gateway.presence,
      profile: gateway,
      protection: gateway,
      register: gateway.identityRegistration,
    });
    this.messages = new PigeonMessagesApplication({
      addMessageReaction: gateway,
      createLinkPreview: gateway,
      decryptMessage: gateway,
      deleteConversationDraft: gateway,
      deleteMessage: gateway,
      editMessage: gateway,
      listConversationDrafts: gateway,
      listMessagePins: gateway,
      loadMessage: gateway,
      loadMessages: gateway,
      loadMessagesAround: gateway,
      loadMessageThread: gateway,
      pinMessage: gateway,
      removeMessageReaction: gateway,
      saveConversationDraft: gateway,
      sendMessage: gateway,
      unpinMessage: gateway,
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
        keychainPublisher: gateway,
        keyDecryptor: new PigeonConversationInvitationKeyDecryptor(),
        notifications: gateway,
      },
      listNotifications: gateway,
      listNotificationSettings: gateway,
      push: gateway,
      resetNotificationSetting: gateway,
      saveNotificationSetting: gateway,
      updateNotification: gateway,
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
    this.session = new PigeonSessionApplication(gateway);
    this.stickers = new PigeonStickersApplication({
      addStickerToPack: gateway,
      assetUrl: gateway,
      createStickerPack: gateway,
      deleteSticker: gateway,
      favoriteSticker: gateway,
      getMyStickers: gateway,
      getStickerPack: gateway,
      listStickerPacks: {
        list: async (message: ListStickerPacksMessage) =>
          await gateway.listStickerPacks({
            ownerIdentityId: message.getOwnerIdentityId(),
          }),
      },
      markStickerUsed: gateway,
      saveStickerPack: gateway,
      unfavoriteSticker: gateway,
      unsaveStickerPack: gateway,
      updateSticker: gateway,
      updateStickerPack: gateway,
      uploadStickerAsset: gateway,
    });
  }
}
