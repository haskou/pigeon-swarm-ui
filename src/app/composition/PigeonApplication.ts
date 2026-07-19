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
import { CommunityMemberRolesAssigner } from '../../contexts/communities/application/assign-community-member-roles/CommunityMemberRolesAssigner';
import { CommunityMemberBanner } from '../../contexts/communities/application/ban-community-member/CommunityMemberBanner';
import { CommunityChannelCreator } from '../../contexts/communities/application/create-community-channel/CommunityChannelCreator';
import { CommunityRoleCreator } from '../../contexts/communities/application/create-community-role/CommunityRoleCreator';
import { CommunityFinder } from '../../contexts/communities/application/find-community/CommunityFinder';
import { CommunityMemberKicker } from '../../contexts/communities/application/kick-community-member/CommunityMemberKicker';
import { CommunityChannelRemover } from '../../contexts/communities/application/remove-community-channel/CommunityChannelRemover';
import { CommunityRoleRemover } from '../../contexts/communities/application/remove-community-role/CommunityRoleRemover';
import { CommunityChannelRenamer } from '../../contexts/communities/application/rename-community-channel/CommunityChannelRenamer';
import { CommunitiesSearcher } from '../../contexts/communities/application/search-communities/CommunitiesSearcher';
import { CommunityMemberUnbanner } from '../../contexts/communities/application/unban-community-member/CommunityMemberUnbanner';
import { CommunityChannelPermissionsUpdater } from '../../contexts/communities/application/update-community-channel-permissions/CommunityChannelPermissionsUpdater';
import { CommunityRoleUpdater } from '../../contexts/communities/application/update-community-role/CommunityRoleUpdater';
import { CommunityAccessContexts } from '../../contexts/communities/infrastructure/http/CommunityAccessContexts';
import { CommunityMapper } from '../../contexts/communities/infrastructure/http/CommunityMapper';
import { PigeonCommunityRepository } from '../../contexts/communities/infrastructure/http/PigeonCommunityRepository';
import { ConversationCreator } from '../../contexts/conversations/application/create-conversation/ConversationCreator';
import { GroupConversationCreator } from '../../contexts/conversations/application/create-group-conversation/GroupConversationCreator';
import { ConversationParticipantInviter } from '../../contexts/conversations/application/invite-to-group-conversation/ConversationParticipantInviter';
import { ConversationReadMarker } from '../../contexts/conversations/application/mark-conversation-read-until/ConversationReadMarker';
import { ConversationsSearcher } from '../../contexts/conversations/application/search-conversations/ConversationsSearcher';
import { ConversationIdFactory } from '../../contexts/conversations/domain/ConversationIdFactory';
import { ConversationAccessContexts } from '../../contexts/conversations/infrastructure/http/ConversationAccessContexts';
import { ConversationMapper } from '../../contexts/conversations/infrastructure/http/ConversationMapper';
import { PigeonConversationRepository } from '../../contexts/conversations/infrastructure/http/PigeonConversationRepository';
import { IdentityPresenceFinder } from '../../contexts/identities/application/find-identity-presence/IdentityPresenceFinder';
import { IdentityFinder } from '../../contexts/identities/application/find-identity/IdentityFinder';
import { LoginIdentity } from '../../contexts/identities/application/login-identity/LoginIdentity';
import { IdentityRefresher } from '../../contexts/identities/application/refresh-identity/IdentityRefresher';
import { RegisterIdentity } from '../../contexts/identities/application/register-identity/RegisterIdentity';
import { RememberedIdentityRestorer } from '../../contexts/identities/application/restore-remembered-identity/RememberedIdentityRestorer';
import { IdentityPresencesSearcher } from '../../contexts/identities/application/search-identity-presences/IdentityPresencesSearcher';
import { IdentityPresenceUpdater } from '../../contexts/identities/application/update-identity-presence/IdentityPresenceUpdater';
import { IdentityProfileUpdater } from '../../contexts/identities/application/update-identity-profile/IdentityProfileUpdater';
import { IdentityCreationMaterials } from '../../contexts/identities/infrastructure/crypto/IdentityCreationMaterials';
import { PigeonIdentityIdFactory } from '../../contexts/identities/infrastructure/crypto/PigeonIdentityIdFactory';
import { IdentityAccessContexts } from '../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import { IdentityMapper } from '../../contexts/identities/infrastructure/http/IdentityMapper';
import { IdentityPresenceMapper } from '../../contexts/identities/infrastructure/http/IdentityPresenceMapper';
import { PigeonIdentityRepository } from '../../contexts/identities/infrastructure/http/PigeonIdentityRepository';
import { PigeonIdentityUnlockRepository } from '../../contexts/identities/infrastructure/http/PigeonIdentityUnlockRepository';
import { PigeonPresenceRepository } from '../../contexts/identities/infrastructure/http/PigeonPresenceRepository';
import { MessageReactionAdder } from '../../contexts/messages/application/add-message-reaction/MessageReactionAdder';
import { ConversationDraftDeleter } from '../../contexts/messages/application/delete-conversation-draft/ConversationDraftDeleter';
import { MessageDeleter } from '../../contexts/messages/application/delete-message/MessageDeleter';
import { MessageEditor } from '../../contexts/messages/application/edit-message/MessageEditor';
import { ConversationDraftsSearcher } from '../../contexts/messages/application/list-conversation-drafts/ConversationDraftsSearcher';
import { PinnedMessagesSearcher } from '../../contexts/messages/application/list-message-pins/PinnedMessagesSearcher';
import { MessageThreadSearcher } from '../../contexts/messages/application/load-message-thread/MessageThreadSearcher';
import { MessageFinder } from '../../contexts/messages/application/load-message/MessageFinder';
import { MessagesAroundSearcher } from '../../contexts/messages/application/load-messages-around/MessagesAroundSearcher';
import { MessagesSearcher } from '../../contexts/messages/application/load-messages/MessagesSearcher';
import { MessagePinner } from '../../contexts/messages/application/pin-message/MessagePinner';
import { MessageReactionRemover } from '../../contexts/messages/application/remove-message-reaction/MessageReactionRemover';
import { ConversationDraftSaver } from '../../contexts/messages/application/save-conversation-draft/ConversationDraftSaver';
import { MessageSender } from '../../contexts/messages/application/send-message/MessageSender';
import { MessageUnpinner } from '../../contexts/messages/application/unpin-message/MessageUnpinner';
import { MessageMapper } from '../../contexts/messages/infrastructure/http/MessageMapper';
import { MessageOperationContexts } from '../../contexts/messages/infrastructure/http/MessageOperationContexts';
import { PigeonDraftRepository } from '../../contexts/messages/infrastructure/http/PigeonDraftRepository';
import { PigeonMessageRepository } from '../../contexts/messages/infrastructure/http/PigeonMessageRepository';
import { NetworkNodeClaimer } from '../../contexts/networks/application/claim-network-node/NetworkNodeClaimer';
import { NetworkCreator } from '../../contexts/networks/application/create-network/NetworkCreator';
import { PublicNetworkCreator } from '../../contexts/networks/application/create-public-network/PublicNetworkCreator';
import { NodeRelayConfigurationFinder } from '../../contexts/networks/application/find-node-relay-configuration/NodeRelayConfigurationFinder';
import { NetworkJoiner } from '../../contexts/networks/application/join-network/NetworkJoiner';
import { NodeNetworkRemover } from '../../contexts/networks/application/remove-node-network/NodeNetworkRemover';
import { NetworkPeersSearcher } from '../../contexts/networks/application/search-network-peers/NetworkPeersSearcher';
import { NodeNetworksSearcher } from '../../contexts/networks/application/search-node-networks/NodeNetworksSearcher';
import { NodeRelayConfigurationUpdater } from '../../contexts/networks/application/update-node-relay-configuration/NodeRelayConfigurationUpdater';
import { NetworkMapper } from '../../contexts/networks/infrastructure/http/mapping/NetworkMapper';
import { NetworkNodeMapper } from '../../contexts/networks/infrastructure/http/mapping/NetworkNodeMapper';
import { NetworkPeerMapper } from '../../contexts/networks/infrastructure/http/mapping/NetworkPeerMapper';
import { NodeRelayConfigurationMapper } from '../../contexts/networks/infrastructure/http/mapping/NodeRelayConfigurationMapper';
import { PigeonNetworkNodeRepository } from '../../contexts/networks/infrastructure/http/repositories/PigeonNetworkNodeRepository';
import { PigeonNetworkPeerRepository } from '../../contexts/networks/infrastructure/http/repositories/PigeonNetworkPeerRepository';
import { PigeonNetworkRepository } from '../../contexts/networks/infrastructure/http/repositories/PigeonNetworkRepository';
import { PigeonNodeRelayConfigurationRepository } from '../../contexts/networks/infrastructure/http/repositories/PigeonNodeRelayConfigurationRepository';
import { NodeRelayConfigurationViewModelMapper } from '../../contexts/networks/presentation/view-models/NodeRelayConfigurationViewModelMapper';
import { ConversationInvitationAcceptor } from '../../contexts/notifications/application/accept-conversation-invitation/ConversationInvitationAcceptor';
import { NotificationSettingConfigurer } from '../../contexts/notifications/application/configure-notification-setting/NotificationSettingConfigurer';
import { NotificationDecider } from '../../contexts/notifications/application/decide-notification/NotificationDecider';
import { PushNotificationServerFinder } from '../../contexts/notifications/application/find-push-notification-server/PushNotificationServerFinder';
import { PushSubscriptionRegistrar } from '../../contexts/notifications/application/register-push-subscription/PushSubscriptionRegistrar';
import { PushSubscriptionRemover } from '../../contexts/notifications/application/remove-push-subscription/PushSubscriptionRemover';
import { NotificationSettingResetter } from '../../contexts/notifications/application/reset-notification-setting/NotificationSettingResetter';
import { NotificationSettingsSearcher } from '../../contexts/notifications/application/search-notification-settings/NotificationSettingsSearcher';
import { NotificationsSearcher } from '../../contexts/notifications/application/search-notifications/NotificationsSearcher';
import { PigeonConversationInvitationKeyDecryptor } from '../../contexts/notifications/infrastructure/crypto/PigeonConversationInvitationKeyDecryptor';
import { PigeonInvitationKeyRecipient } from '../../contexts/notifications/infrastructure/crypto/PigeonInvitationKeyRecipient';
import { NotificationAccessContexts } from '../../contexts/notifications/infrastructure/http/NotificationAccessContexts';
import { NotificationMapper } from '../../contexts/notifications/infrastructure/http/NotificationMapper';
import { NotificationSettingMapper } from '../../contexts/notifications/infrastructure/http/NotificationSettingMapper';
import { PigeonNotificationRepository } from '../../contexts/notifications/infrastructure/http/PigeonNotificationRepository';
import { PigeonNotificationSettingRepository } from '../../contexts/notifications/infrastructure/http/PigeonNotificationSettingRepository';
import { PigeonPushNotificationServerRepository } from '../../contexts/notifications/infrastructure/http/PigeonPushNotificationServerRepository';
import { PigeonPushSubscriptionRepository } from '../../contexts/notifications/infrastructure/http/PigeonPushSubscriptionRepository';
import { PushSubscriptionMapper } from '../../contexts/notifications/infrastructure/http/PushSubscriptionMapper';
import { PollCloser } from '../../contexts/polls/application/close-poll/PollCloser';
import { PollCreator } from '../../contexts/polls/application/create-poll/PollCreator';
import { PollFinder } from '../../contexts/polls/application/find-poll/PollFinder';
import { PollVoteRemover } from '../../contexts/polls/application/remove-poll-vote/PollVoteRemover';
import { PollVoter } from '../../contexts/polls/application/vote-poll/PollVoter';
import { PigeonPollRepository } from '../../contexts/polls/infrastructure/http/PigeonPollRepository';
import { PollAccessContexts } from '../../contexts/polls/infrastructure/http/PollAccessContexts';
import { PollMapper } from '../../contexts/polls/infrastructure/http/PollMapper';
import { StickerAdder } from '../../contexts/stickers/application/add-sticker-to-pack/StickerAdder';
import { StickerPackCreator } from '../../contexts/stickers/application/create-sticker-pack/StickerPackCreator';
import { StickerRemover } from '../../contexts/stickers/application/delete-sticker/StickerRemover';
import { StickerFavoriter } from '../../contexts/stickers/application/favorite-sticker/StickerFavoriter';
import { StickerLibraryFinder } from '../../contexts/stickers/application/get-my-stickers/StickerLibraryFinder';
import { StickerPackFinder } from '../../contexts/stickers/application/get-sticker-pack/StickerPackFinder';
import { ListStickerPacks } from '../../contexts/stickers/application/list-sticker-packs/ListStickerPacks';
import { StickerUsageMarker } from '../../contexts/stickers/application/mark-sticker-used/StickerUsageMarker';
import { StickerPackSaver } from '../../contexts/stickers/application/save-sticker-pack/StickerPackSaver';
import { StickerUnfavoriter } from '../../contexts/stickers/application/unfavorite-sticker/StickerUnfavoriter';
import { StickerPackUnsaver } from '../../contexts/stickers/application/unsave-sticker-pack/StickerPackUnsaver';
import { StickerPackRenamer } from '../../contexts/stickers/application/update-sticker-pack/StickerPackRenamer';
import { StickerUpdater } from '../../contexts/stickers/application/update-sticker/StickerUpdater';
import { PigeonStickerLibraryRepository } from '../../contexts/stickers/infrastructure/http/PigeonStickerLibraryRepository';
import { PigeonStickerPackRepository } from '../../contexts/stickers/infrastructure/http/PigeonStickerPackRepository';
import { StickerAccessContexts } from '../../contexts/stickers/infrastructure/http/StickerAccessContexts';
import { StickerLibraryMapper } from '../../contexts/stickers/infrastructure/http/StickerLibraryMapper';
import { StickerMapper } from '../../contexts/stickers/infrastructure/http/StickerMapper';
import { StickerPackMapper } from '../../contexts/stickers/infrastructure/http/StickerPackMapper';
import { RealtimeGateway } from '../../shared/infrastructure/realtime/RealtimeGateway';
import { CallSessionRegistrar } from './calls/CallSessionRegistrar';
import { PigeonCallParticipation } from './calls/PigeonCallParticipation';
import { PigeonCallReader } from './calls/PigeonCallReader';
import { PigeonCallSignaling } from './calls/PigeonCallSignaling';
import { PigeonCallStarter } from './calls/PigeonCallStarter';
import { PigeonCommunityManagement } from './communities/PigeonCommunityManagement';
import { PigeonConversationsFacade } from './conversations/PigeonConversationsFacade';
import { PigeonIdentitiesFacade } from './identities/PigeonIdentitiesFacade';
import { PigeonSessionFacade } from './identities/PigeonSessionFacade';
import { PigeonConversationDrafts } from './messages/PigeonConversationDrafts';
import { PigeonMessagePins } from './messages/PigeonMessagePins';
import { PigeonMessageReactions } from './messages/PigeonMessageReactions';
import { PigeonMessageReader } from './messages/PigeonMessageReader';
import { PigeonMessagesFacade } from './messages/PigeonMessagesFacade';
import { PigeonMessageWriter } from './messages/PigeonMessageWriter';
import { PigeonNetworksFacade } from './networks/PigeonNetworksFacade';
import { PigeonNodeFacade } from './networks/PigeonNodeFacade';
import { PigeonNotificationsFacade } from './notifications/PigeonNotificationsFacade';
import { PigeonApiGateway } from './PigeonApiGateway';
import { PigeonAttachmentsFacade } from './PigeonAttachmentsFacade';
import { PigeonCallsFacade } from './PigeonCallsFacade';
import { PigeonCommunitiesFacade } from './PigeonCommunitiesFacade';
import { PigeonRealtimeApplication } from './PigeonRealtimeApplication';
import { PigeonPollsFacade } from './polls/PigeonPollsFacade';
import { PigeonStickersFacade } from './stickers/PigeonStickersFacade';

export class PigeonApplication {
  public readonly attachments: PigeonAttachmentsFacade;

  public readonly calls: PigeonCallsFacade;

  public readonly communities: PigeonCommunitiesFacade;

  public readonly conversations: PigeonConversationsFacade;

  public readonly identities: PigeonIdentitiesFacade;

  public readonly messages: PigeonMessagesFacade;

  public readonly networks: PigeonNetworksFacade;

  public readonly notifications: PigeonNotificationsFacade;

  public readonly polls: PigeonPollsFacade;

  public readonly realtime: PigeonRealtimeApplication;

  public readonly session: PigeonSessionFacade;

  public readonly stickers: PigeonStickersFacade;

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
    const communityContexts = new CommunityAccessContexts();
    const communityMapper = new CommunityMapper();
    const communityRepository = new PigeonCommunityRepository(
      gateway.communityGateway,
      communityContexts,
      communityMapper,
    );
    this.communities = new PigeonCommunitiesFacade(
      gateway.communityGateway,
      gateway.identityGateway,
      new PigeonCommunityManagement(communityContexts, communityMapper, {
        assigner: new CommunityMemberRolesAssigner(communityRepository),
        banner: new CommunityMemberBanner(communityRepository),
        channelCreator: new CommunityChannelCreator(communityRepository),
        channelRemover: new CommunityChannelRemover(communityRepository),
        channelRenamer: new CommunityChannelRenamer(communityRepository),
        finder: new CommunityFinder(communityRepository),
        kicker: new CommunityMemberKicker(communityRepository),
        permissionsUpdater: new CommunityChannelPermissionsUpdater(
          communityRepository,
        ),
        roleCreator: new CommunityRoleCreator(communityRepository),
        roleRemover: new CommunityRoleRemover(communityRepository),
        roleUpdater: new CommunityRoleUpdater(communityRepository),
        searcher: new CommunitiesSearcher(communityRepository),
        unbanner: new CommunityMemberUnbanner(communityRepository),
      }),
    );
    const conversationContexts = new ConversationAccessContexts();
    const conversationMapper = new ConversationMapper();
    const conversationRepository = new PigeonConversationRepository(
      gateway.conversationsGateway,
      gateway.messagesGateway,
      conversationContexts,
      conversationMapper,
    );
    this.conversations = new PigeonConversationsFacade(
      conversationContexts,
      conversationMapper,
      {
        creator: new ConversationCreator(
          conversationRepository,
          new ConversationIdFactory(),
        ),
        groupCreator: new GroupConversationCreator(
          conversationRepository,
          new ConversationIdFactory(),
        ),
        participantInviter: new ConversationParticipantInviter(
          conversationRepository,
        ),
        readMarker: new ConversationReadMarker(conversationRepository),
        searcher: new ConversationsSearcher(conversationRepository),
      },
    );
    const identityContexts = new IdentityAccessContexts();
    const identityCreationMaterials = new IdentityCreationMaterials();
    const identityIdFactory = new PigeonIdentityIdFactory(
      identityCreationMaterials,
    );
    const identityMapper = new IdentityMapper();
    const identityPresenceMapper = new IdentityPresenceMapper();
    const identityRepository = new PigeonIdentityRepository(
      gateway.identityGateway,
      identityContexts,
      identityMapper,
      identityCreationMaterials,
      gateway.identityKeyProtection,
    );
    const identityUnlockRepository = new PigeonIdentityUnlockRepository(
      gateway.identityGateway,
      identityContexts,
      identityMapper,
    );
    const identityPresenceRepository = new PigeonPresenceRepository(
      gateway.presence,
      identityContexts,
      identityPresenceMapper,
    );
    this.identities = new PigeonIdentitiesFacade(
      gateway.identityGateway,
      identityContexts,
      identityMapper,
      identityPresenceMapper,
      {
        finder: new IdentityFinder(identityRepository),
        login: new LoginIdentity(identityUnlockRepository),
        presenceFinder: new IdentityPresenceFinder(identityPresenceRepository),
        presenceSearcher: new IdentityPresencesSearcher(
          identityPresenceRepository,
        ),
        presenceUpdater: new IdentityPresenceUpdater(
          identityPresenceRepository,
        ),
        profileUpdater: new IdentityProfileUpdater(identityRepository),
        refresher: new IdentityRefresher(identityRepository),
        register: new RegisterIdentity(identityRepository, identityIdFactory),
        rememberedIdentityRestorer: new RememberedIdentityRestorer(
          identityUnlockRepository,
        ),
      },
    );
    const messageMapper = new MessageMapper();
    const messageOperationContexts = new MessageOperationContexts();
    const messageRepository = new PigeonMessageRepository(
      gateway.messagesApi,
      gateway.messageCommands,
      identityContexts,
      messageMapper,
      messageOperationContexts,
    );
    const conversationDraftRepository = new PigeonDraftRepository(
      gateway.messagesApi,
      identityContexts,
    );
    this.messages = new PigeonMessagesFacade(
      new PigeonMessageReader(
        identityContexts,
        messageOperationContexts,
        messageMapper,
        new MessageFinder(messageRepository),
        new MessagesSearcher(messageRepository),
        new MessagesAroundSearcher(messageRepository),
        new MessageThreadSearcher(messageRepository),
      ),
      new PigeonMessageWriter(
        identityContexts,
        messageOperationContexts,
        messageMapper,
        new MessageSender(messageRepository),
        new MessageEditor(messageRepository),
        new MessageDeleter(messageRepository),
      ),
      new PigeonConversationDrafts(
        identityContexts,
        new ConversationDraftDeleter(conversationDraftRepository),
        new ConversationDraftsSearcher(conversationDraftRepository),
        new ConversationDraftSaver(conversationDraftRepository),
      ),
      new PigeonMessageReactions(
        identityContexts,
        new MessageReactionAdder(messageRepository),
        new MessageReactionRemover(messageRepository),
      ),
      new PigeonMessagePins(
        identityContexts,
        messageMapper,
        new PinnedMessagesSearcher(messageRepository),
        new MessagePinner(messageRepository),
        new MessageUnpinner(messageRepository),
      ),
      gateway.messagesGateway,
    );
    const networkRepository = new PigeonNetworkRepository(
      gateway.node,
      identityContexts,
      new NetworkMapper(),
    );
    const nodeRelayConfigurationRepository =
      new PigeonNodeRelayConfigurationRepository(
        gateway.node,
        identityContexts,
        new NodeRelayConfigurationMapper(),
      );
    const networkNodeRepository = new PigeonNetworkNodeRepository(
      gateway.node,
      identityContexts,
      new NetworkNodeMapper(),
    );

    const nodeFacade = new PigeonNodeFacade(
      identityContexts,
      new NetworkNodeClaimer(networkNodeRepository),
      new PublicNetworkCreator(networkNodeRepository),
      new NodeRelayConfigurationFinder(nodeRelayConfigurationRepository),
      new NodeRelayConfigurationUpdater(nodeRelayConfigurationRepository),
      new NodeRelayConfigurationViewModelMapper(),
      gateway.node,
    );

    this.networks = new PigeonNetworksFacade(
      identityContexts,
      new NetworkCreator(networkRepository),
      new NetworkJoiner(networkRepository),
      new NodeNetworksSearcher(networkRepository),
      new NodeNetworkRemover(networkRepository),
      new NetworkPeersSearcher(
        new PigeonNetworkPeerRepository(gateway.node, new NetworkPeerMapper()),
      ),
      nodeFacade,
    );
    const notificationContexts = new NotificationAccessContexts();
    const notificationMapper = new NotificationMapper();
    const notificationSettingMapper = new NotificationSettingMapper();
    const notificationRepository = new PigeonNotificationRepository(
      gateway.notificationsGateway,
      notificationContexts,
      notificationMapper,
    );
    const notificationSettingRepository =
      new PigeonNotificationSettingRepository(
        gateway.notificationsGateway,
        notificationContexts,
        notificationSettingMapper,
      );
    const pushSubscriptionRepository = new PigeonPushSubscriptionRepository(
      gateway.pushApi,
      notificationContexts,
      new PushSubscriptionMapper(),
    );
    const pushNotificationServerRepository =
      new PigeonPushNotificationServerRepository(gateway.pushApi);
    this.notifications = new PigeonNotificationsFacade(
      notificationContexts,
      notificationMapper,
      notificationSettingMapper,
      {
        invitationAcceptor: new ConversationInvitationAcceptor(
          notificationRepository,
          new PigeonInvitationKeyRecipient(
            notificationContexts,
            new PigeonConversationInvitationKeyDecryptor(),
            gateway.identityGateway,
          ),
        ),
        notificationDecider: new NotificationDecider(notificationRepository),
        notificationSearcher: new NotificationsSearcher(notificationRepository),
        pushServerFinder: new PushNotificationServerFinder(
          pushNotificationServerRepository,
        ),
        pushSubscriptionRegistrar: new PushSubscriptionRegistrar(
          pushSubscriptionRepository,
        ),
        pushSubscriptionRemover: new PushSubscriptionRemover(
          pushSubscriptionRepository,
        ),
        settingConfigurer: new NotificationSettingConfigurer(
          notificationSettingRepository,
        ),
        settingResetter: new NotificationSettingResetter(
          notificationSettingRepository,
        ),
        settingSearcher: new NotificationSettingsSearcher(
          notificationSettingRepository,
        ),
      },
    );
    const pollContexts = new PollAccessContexts();
    const pollMapper = new PollMapper();
    const pollRepository = new PigeonPollRepository(
      gateway.pollsApi,
      pollContexts,
      pollMapper,
    );
    this.polls = new PigeonPollsFacade(pollContexts, pollMapper, {
      closer: new PollCloser(pollRepository),
      creator: new PollCreator(pollRepository),
      finder: new PollFinder(pollRepository),
      voter: new PollVoter(pollRepository),
      voteRemover: new PollVoteRemover(pollRepository),
    });
    this.realtime = new PigeonRealtimeApplication(realtime);
    this.session = new PigeonSessionFacade(
      gateway.identityGateway,
      this.identities,
    );
    const stickerContexts = new StickerAccessContexts();
    const stickerMapper = new StickerMapper();
    const stickerPackMapper = new StickerPackMapper(stickerMapper);
    const stickerLibraryMapper = new StickerLibraryMapper(
      stickerPackMapper,
      stickerMapper,
    );
    const stickerPackRepository = new PigeonStickerPackRepository(
      gateway.stickersApi,
      stickerContexts,
      stickerPackMapper,
      stickerMapper,
    );
    const stickerLibraryRepository = new PigeonStickerLibraryRepository(
      gateway.stickersApi,
      stickerContexts,
      stickerLibraryMapper,
    );
    this.stickers = new PigeonStickersFacade(
      gateway.stickersApi,
      gateway.apiUrl.bind(gateway),
      stickerContexts,
      stickerLibraryMapper,
      stickerPackMapper,
      stickerMapper,
      {
        adder: new StickerAdder(stickerPackRepository),
        creator: new StickerPackCreator(stickerPackRepository),
        favoriter: new StickerFavoriter(
          stickerLibraryRepository,
          stickerPackRepository,
        ),
        libraryFinder: new StickerLibraryFinder(stickerLibraryRepository),
        packFinder: new StickerPackFinder(stickerPackRepository),
        packLister: new ListStickerPacks(stickerPackRepository),
        packRenamer: new StickerPackRenamer(stickerPackRepository),
        packSaver: new StickerPackSaver(
          stickerLibraryRepository,
          stickerPackRepository,
        ),
        packUnsaver: new StickerPackUnsaver(stickerLibraryRepository),
        remover: new StickerRemover(stickerPackRepository),
        unfavoriter: new StickerUnfavoriter(stickerLibraryRepository),
        updater: new StickerUpdater(stickerPackRepository),
        usageMarker: new StickerUsageMarker(
          stickerLibraryRepository,
          stickerPackRepository,
        ),
      },
    );
  }
}
