import type { ListCommunitiesMessage } from '../../contexts/communities/application/list-communities/messages/ListCommunitiesMessage';
import type { ListStickerPacksMessage } from '../../contexts/stickers/application/list-sticker-packs/messages/ListStickerPacksMessage';

import { CallEnder } from '../../contexts/calls/application/end-call/CallEnder';
import { CallFinder } from '../../contexts/calls/application/find-call/CallFinder';
import { CallParticipantHeartbeater } from '../../contexts/calls/application/heartbeat-participant/CallParticipantHeartbeater';
import { CallJoiner } from '../../contexts/calls/application/join-call/CallJoiner';
import { CallLeaver } from '../../contexts/calls/application/leave-call/CallLeaver';
import { CallsSearcher } from '../../contexts/calls/application/search-calls/CallsSearcher';
import { CallSignalSender } from '../../contexts/calls/application/send-call-signal/CallSignalSender';
import { CommunityChannelCallStarter } from '../../contexts/calls/application/start-community-channel-call/CommunityChannelCallStarter';
import { ConversationCallStarter } from '../../contexts/calls/application/start-conversation-call/ConversationCallStarter';
import { CallAccessContexts } from '../../contexts/calls/infrastructure/http/CallAccessContexts';
import { CallMapper } from '../../contexts/calls/infrastructure/http/CallMapper';
import { PigeonCallRepository } from '../../contexts/calls/infrastructure/http/PigeonCallRepository';
import { PigeonCallSignalRepository } from '../../contexts/calls/infrastructure/http/PigeonCallSignalRepository';
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
import { CallSessionRegistrar } from './calls/CallSessionRegistrar';
import { PigeonCallParticipation } from './calls/PigeonCallParticipation';
import { PigeonCallReader } from './calls/PigeonCallReader';
import { PigeonCallSignaling } from './calls/PigeonCallSignaling';
import { PigeonCallStarter } from './calls/PigeonCallStarter';
import { PigeonApiGateway } from './PigeonApiGateway';
import { PigeonAttachmentsFacade } from './PigeonAttachmentsFacade';
import { PigeonCallsFacade } from './PigeonCallsFacade';
import { PigeonRealtimeApplication } from './PigeonRealtimeApplication';

export class PigeonApplication {
  public readonly attachments: PigeonAttachmentsFacade;

  public readonly calls: PigeonCallsFacade;

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
    this.attachments = new PigeonAttachmentsFacade(gateway.filesGateway);
    const callContexts = new CallAccessContexts();
    const callMapper = new CallMapper();
    const callRepository = new PigeonCallRepository(
      gateway.calls,
      callContexts,
      callMapper,
    );
    const callSessions = new CallSessionRegistrar(callContexts);
    this.calls = new PigeonCallsFacade(
      new PigeonCallReader(
        callSessions,
        callMapper,
        gateway.calls,
        new CallFinder(callRepository),
        new CallsSearcher(callRepository),
      ),
      new PigeonCallStarter(
        callSessions,
        callMapper,
        new ConversationCallStarter(callRepository),
        new CommunityChannelCallStarter(callRepository),
      ),
      new PigeonCallParticipation(
        gateway.calls,
        callSessions,
        callMapper,
        new CallJoiner(callRepository),
        new CallLeaver(callRepository),
        new CallParticipantHeartbeater(callRepository),
        new CallEnder(callRepository),
      ),
      new PigeonCallSignaling(
        callSessions,
        new CallSignalSender(
          new PigeonCallSignalRepository(gateway.calls, callContexts),
        ),
      ),
    );
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
      closePoll: gateway.pollsGateway,
      createPoll: gateway.pollsGateway,
      getPoll: gateway.pollsGateway,
      removePollVote: gateway.pollsGateway,
      votePoll: {
        vote: async (message) =>
          await gateway.pollsGateway.votePoll(
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
