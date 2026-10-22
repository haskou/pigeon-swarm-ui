import type { Session } from '../../contexts/identities/infrastructure/session/Session';
import type { RequestCacheOptions } from '../../shared/infrastructure/http/RequestCacheOptions';

import { AttachmentFinder } from '../../contexts/attachments/application/find-attachment/AttachmentFinder';
import { PublishMessageAttachment } from '../../contexts/attachments/application/publish-message-attachment/PublishMessageAttachment';
import { AttachmentBinaryCodec } from '../../contexts/attachments/infrastructure/crypto/AttachmentBinaryCodec';
import { AttachmentCipher } from '../../contexts/attachments/infrastructure/crypto/AttachmentCipher';
import { AttachmentPublicationContexts } from '../../contexts/attachments/infrastructure/http/AttachmentPublicationContexts';
import { PigeonAttachmentBlobUploader } from '../../contexts/attachments/infrastructure/http/PigeonAttachmentBlobUploader';
import { PigeonAttachmentDownloader } from '../../contexts/attachments/infrastructure/http/PigeonAttachmentDownloader';
import { PigeonAttachmentPreviewCreator } from '../../contexts/attachments/infrastructure/http/PigeonAttachmentPreviewCreator';
import { PigeonAttachmentRepository } from '../../contexts/attachments/infrastructure/http/PigeonAttachmentRepository';
import { PigeonChunkedAttachmentUploader } from '../../contexts/attachments/infrastructure/http/PigeonChunkedAttachmentUploader';
import { PigeonContentReplicationClient } from '../../contexts/attachments/infrastructure/http/PigeonContentReplicationClient';
import { PigeonDirectAttachmentUploader } from '../../contexts/attachments/infrastructure/http/PigeonDirectAttachmentUploader';
import { PigeonFilesGateway } from '../../contexts/attachments/infrastructure/http/PigeonFilesGateway';
import { PigeonMessageAttachmentUploader } from '../../contexts/attachments/infrastructure/http/PigeonMessageAttachmentUploader';
import { PigeonPrivateBlobClient } from '../../contexts/attachments/infrastructure/http/PigeonPrivateBlobClient';
import { PigeonPublicFilesClient } from '../../contexts/attachments/infrastructure/http/PigeonPublicFilesClient';
import { PigeonPublicFileUploader } from '../../contexts/attachments/infrastructure/http/PigeonPublicFileUploader';
import { PrivateBlobReplicaPlanner } from '../../contexts/attachments/infrastructure/http/PrivateBlobReplicaPlanner';
import { PrivateBlobReplicator } from '../../contexts/attachments/infrastructure/http/PrivateBlobReplicator';
import { PrivateBlobUploadLedger } from '../../contexts/attachments/infrastructure/http/PrivateBlobUploadLedger';
import { MessageAttachmentThumbnailPreparer } from '../../contexts/attachments/infrastructure/media/MessageAttachmentThumbnailPreparer';
import { PublicImageUploadPreparer } from '../../contexts/attachments/infrastructure/media/PublicImageUploadPreparer';
import { CallEventSigner } from '../../contexts/calls/infrastructure/http/CallEventSigner';
import { PigeonCallsApi } from '../../contexts/calls/infrastructure/http/PigeonCallsApi';
import { CallSignalReplicaLogs } from '../../contexts/calls/infrastructure/signals/CallSignalReplicaLogs';
import { PigeonCallSealingApi } from '../../contexts/calls/infrastructure/signals/PigeonCallSealingApi';
import { PigeonCallSignalGenesisReader } from '../../contexts/calls/infrastructure/signals/PigeonCallSignalGenesisReader';
import { PigeonCommunitiesApi } from '../../contexts/communities/infrastructure/http/PigeonCommunitiesApi';
import { PigeonCommunitiesGateway } from '../../contexts/communities/infrastructure/http/PigeonCommunitiesGateway';
import { PigeonCommunityInvitationApi } from '../../contexts/communities/infrastructure/http/PigeonCommunityInvitationApi';
import { PigeonCommunityOperationsApi } from '../../contexts/communities/infrastructure/http/PigeonCommunityOperationsApi';
import { PigeonMlsRecordsApi } from '../../contexts/communities/infrastructure/http/PigeonMlsRecordsApi';
import { ConversationIdFactory } from '../../contexts/conversations/domain/ConversationIdFactory';
import { ConversationMapper } from '../../contexts/conversations/infrastructure/http/ConversationMapper';
import { ConversationOperationSigner } from '../../contexts/conversations/infrastructure/http/ConversationOperationSigner';
import { PigeonConversationCommandsApi } from '../../contexts/conversations/infrastructure/http/PigeonConversationCommandsApi';
import { PigeonConversationsApi } from '../../contexts/conversations/infrastructure/http/PigeonConversationsApi';
import { PigeonConversationsGateway } from '../../contexts/conversations/infrastructure/http/PigeonConversationsGateway';
import { GroupMailboxNotificationLink } from '../../contexts/groupMailboxes/infrastructure/control/GroupMailboxNotificationLink';
import { GroupConversationMailbox } from '../../contexts/groupMailboxes/infrastructure/GroupConversationMailbox';
import { KeychainCipher } from '../../contexts/identities/infrastructure/crypto/KeychainCipher';
import { DeviceAuthorizationRevisionSource } from '../../contexts/identities/infrastructure/http/DeviceAuthorizationRevisionSource';
import { DeviceSealedRecovery } from '../../contexts/identities/infrastructure/http/DeviceSealedRecovery';
import { DeviceSealedRootRotation } from '../../contexts/identities/infrastructure/http/DeviceSealedRootRotation';
import { IdentityMailboxHomeVerifier } from '../../contexts/identities/infrastructure/http/IdentityMailboxHomeVerifier';
import { IdentitySignaturePayloadFactory } from '../../contexts/identities/infrastructure/http/IdentitySignaturePayloadFactory';
import { PigeonDeviceAuthorizationApi } from '../../contexts/identities/infrastructure/http/PigeonDeviceAuthorizationApi';
import { PigeonDeviceSealedSecretApi } from '../../contexts/identities/infrastructure/http/PigeonDeviceSealedSecretApi';
import { PigeonIdentitiesGateway } from '../../contexts/identities/infrastructure/http/PigeonIdentitiesGateway';
import { PigeonIdentityCommandsApi } from '../../contexts/identities/infrastructure/http/PigeonIdentityCommandsApi';
import { PigeonIdentityGateway } from '../../contexts/identities/infrastructure/http/PigeonIdentityGateway';
import { PigeonIdentityLoginApi } from '../../contexts/identities/infrastructure/http/PigeonIdentityLoginApi';
import { PigeonIdentitySessionApi } from '../../contexts/identities/infrastructure/http/PigeonIdentitySessionApi';
import { PigeonIdentityWorkspaceSessionApi } from '../../contexts/identities/infrastructure/http/PigeonIdentityWorkspaceSessionApi';
import { PigeonKeychainApi } from '../../contexts/identities/infrastructure/http/PigeonKeychainApi';
import { PigeonPresenceApi } from '../../contexts/identities/infrastructure/http/PigeonPresenceApi';
import { PigeonPresenceGateway } from '../../contexts/identities/infrastructure/http/PigeonPresenceGateway';
import { ContactPinStore } from '../../contexts/identities/infrastructure/storage/ContactPinStore';
import { DeviceIdentityVault } from '../../contexts/identities/infrastructure/storage/DeviceIdentityVault';
import { DeviceSealedRecoveryStore } from '../../contexts/identities/infrastructure/storage/DeviceSealedRecoveryStore';
import { DeviceSealedRootTrustStore } from '../../contexts/identities/infrastructure/storage/DeviceSealedRootTrustStore';
import { LazyMailboxCreationMiner } from '../../contexts/mailboxes/infrastructure/crypto/LazyMailboxCreationMiner';
import { PigeonMailboxClient } from '../../contexts/mailboxes/infrastructure/http/PigeonMailboxClient';
import { MailboxChannel } from '../../contexts/mailboxes/infrastructure/MailboxChannel';
import { DraftPayloadCipher } from '../../contexts/messages/infrastructure/crypto/DraftPayloadCipher';
import { MessageProjector } from '../../contexts/messages/infrastructure/crypto/MessageProjector';
import { PigeonMessageProjection } from '../../contexts/messages/infrastructure/crypto/PigeonMessageProjection';
import { PigeonConversationDraftsApi } from '../../contexts/messages/infrastructure/http/PigeonConversationDraftsApi';
import { PigeonLinkPreviewsApi } from '../../contexts/messages/infrastructure/http/PigeonLinkPreviewsApi';
import { PigeonMessageCommandsApi } from '../../contexts/messages/infrastructure/http/PigeonMessageCommandsApi';
import { DirectMessageMailbox } from '../../contexts/messages/infrastructure/mailbox/DirectMessageMailbox';
import { DirectMessageMailboxStore } from '../../contexts/messages/infrastructure/mailbox/DirectMessageMailboxStore';
import { DirectMessageReaderSet } from '../../contexts/messages/infrastructure/mailbox/DirectMessageReaderSet';
import { RecipientMailboxRouter } from '../../contexts/messages/infrastructure/mailbox/RecipientMailboxRouter';
import { PigeonNodeApi } from '../../contexts/networks/infrastructure/http/PigeonNodeApi';
import { PigeonNodeAccessApi } from '../../contexts/nodeAccess/infrastructure/http/PigeonNodeAccessApi';
import { NotificationMutationSigner } from '../../contexts/notifications/infrastructure/http/NotificationMutationSigner';
import { PigeonNotificationsApi } from '../../contexts/notifications/infrastructure/http/PigeonNotificationsApi';
import { PigeonNotificationsGateway } from '../../contexts/notifications/infrastructure/http/PigeonNotificationsGateway';
import { PigeonPushApi } from '../../contexts/notifications/infrastructure/http/PigeonPushApi';
import { PigeonPushGateway } from '../../contexts/notifications/infrastructure/http/PigeonPushGateway';
import { PigeonPollsApi } from '../../contexts/polls/infrastructure/http/PigeonPollsApi';
import { PigeonStickersApi } from '../../contexts/stickers/infrastructure/http/PigeonStickersApi';
import { MailboxAvailabilityServers } from '../../shared/infrastructure/client/MailboxAvailabilityServers';
import { MailboxHomeBase } from '../../shared/infrastructure/client/MailboxHomeBase';
import { PublicMutationSigner } from '../../shared/infrastructure/crypto/PublicMutationSigner';
import { ApiUrlBuilder } from '../../shared/infrastructure/http/ApiUrlBuilder';
import { HttpJsonClient } from '../../shared/infrastructure/http/HttpJsonClient';
import { RequestCache } from '../../shared/infrastructure/http/RequestCache';
import { RequestSigner } from '../../shared/infrastructure/http/RequestSigner';
import { scopeClientStorageKey } from '../../shared/infrastructure/storage/ClientStorageScope';
import { copy } from '../../shared/presentation/i18n/copy';
import { API_SERVER_URL } from '../API_SERVER_URL';
import { MAILBOX_AVAILABILITY_SERVERS } from '../MAILBOX_AVAILABILITY_SERVERS';

export class PigeonApiGateway {
  private readonly requestCache = new RequestCache();

  private readonly attachmentCipher: AttachmentCipher;

  public readonly calls: PigeonCallsApi;

  public readonly callSealing: PigeonCallSealingApi;

  public readonly callSignalGenesis: PigeonCallSignalGenesisReader;

  public readonly callSignalReplicas: CallSignalReplicaLogs;

  public readonly communityGateway: PigeonCommunitiesGateway;

  public readonly mlsRecords: PigeonMlsRecordsApi;

  public readonly communityOperations: PigeonCommunityOperationsApi;

  public readonly conversationsGateway: PigeonConversationsGateway;

  public readonly filesGateway: PigeonFilesGateway;

  public readonly directMessageMailbox: DirectMessageMailbox;

  public readonly groupConversationMailbox: GroupConversationMailbox;

  public readonly identityGateway: PigeonIdentitiesGateway;

  public readonly identityVault: DeviceIdentityVault;

  public readonly mailboxChannel: MailboxChannel;

  private readonly mailboxMiner: LazyMailboxCreationMiner;

  /** Routes an append to the recipient's verified home, else this node. */
  public readonly recipientMailboxes: RecipientMailboxRouter;

  public readonly conversationDrafts: PigeonConversationDraftsApi;

  public readonly linkPreviews: PigeonLinkPreviewsApi;

  public readonly messageCommands: PigeonMessageCommandsApi;

  private readonly messageProjection: PigeonMessageProjection;

  public readonly node: PigeonNodeApi;

  public readonly nodeAccess: PigeonNodeAccessApi;

  public readonly notificationsGateway: PigeonNotificationsGateway;

  public readonly pollsApi: PigeonPollsApi;

  public readonly presence: PigeonPresenceGateway;

  public readonly publishMessageAttachmentUseCase: PublishMessageAttachment;

  public readonly pushApi: PigeonPushApi;

  public readonly pushGateway: PigeonPushGateway;

  public readonly stickersApi: PigeonStickersApi;

  public constructor(
    http: HttpJsonClient = new HttpJsonClient(
      new ApiUrlBuilder(API_SERVER_URL),
    ),
    signer: RequestSigner = new RequestSigner(
      undefined,
      ApiUrlBuilder.pathPrefix(API_SERVER_URL),
    ),
    conversationMapper: ConversationMapper = new ConversationMapper(),
    messageProjector: MessageProjector = new MessageProjector(copy.messages),
    {
      attachmentCipher = AttachmentCipher.inCurrentThread(),
      conversationIds = new ConversationIdFactory(),
      keychainCipher = new KeychainCipher(),
      storage = globalThis.localStorage,
    }: {
      attachmentCipher?: AttachmentCipher;
      conversationIds?: ConversationIdFactory;
      keychainCipher?: KeychainCipher;
      storage?: Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;
    } = {},
  ) {
    this.attachmentCipher = attachmentCipher;
    this.identityVault = new DeviceIdentityVault();
    const deviceAuthorization = new PigeonDeviceAuthorizationApi(
      http,
      signer,
      this.identityVault,
    );
    const deviceSealedSecrets = new PigeonDeviceSealedSecretApi(http, signer);
    const keychainApi = new PigeonKeychainApi(
      http,
      signer,
      keychainCipher,
      this.requestCache,
      this.identityVault,
    );
    const deviceSealedRoot = new DeviceSealedRootRotation(
      deviceAuthorization,
      deviceSealedSecrets,
      keychainApi,
      new DeviceSealedRootTrustStore(storage),
    );
    const deviceSealedRecovery = new DeviceSealedRecovery(
      deviceSealedRoot,
      keychainApi,
      new DeviceSealedRecoveryStore(storage),
    );
    const mutations = new PublicMutationSigner(
      new DeviceAuthorizationRevisionSource(deviceAuthorization),
    );
    const communitiesApi = new PigeonCommunitiesApi(
      http,
      signer,
      <T>(
        key: string,
        loader: () => Promise<T>,
        options?: RequestCacheOptions,
      ) => this.requestCache.load(key, loader, options),
      mutations,
      new DraftPayloadCipher(),
      (key: string) => this.requestCache.invalidate(key),
    );
    const conversationsApi = new PigeonConversationsApi(
      http,
      signer,
      conversationMapper,
    );
    this.calls = new PigeonCallsApi(
      http,
      signer,
      new CallEventSigner(mutations),
      {
        communityNetworkId: async (session, communityId) =>
          (await communitiesApi.get(session, communityId)).networkId,
        conversation: async (session, conversationId) => {
          const conversation = (await conversationsApi.list(session)).find(
            (candidate) => candidate.id === conversationId,
          );

          if (!conversation) {
            throw new Error(`Conversation ${conversationId} is not available`);
          }

          return conversation;
        },
      },
    );
    const contentReplication = new PigeonContentReplicationClient(
      http,
      signer,
      mutations,
    );
    const identityResourceGateway = new PigeonIdentityGateway(http);
    const ownHome = () =>
      MailboxHomeBase.fromApiBase(API_SERVER_URL, window.location.origin);
    const verifiedRecipientBase = async (identityId: string) =>
      IdentityMailboxHomeVerifier.verifiedBase(
        identityId,
        await identityResourceGateway.get(identityId),
      );
    this.callSealing = new PigeonCallSealingApi(http, signer);
    this.callSignalGenesis = new PigeonCallSignalGenesisReader(
      identityResourceGateway,
    );
    this.callSignalReplicas = new CallSignalReplicaLogs(
      this.callSealing,
      ownHome,
      verifiedRecipientBase,
      (origin) =>
        new PigeonCallSealingApi(
          new HttpJsonClient(new ApiUrlBuilder(origin), { isolated: true }),
          new RequestSigner(undefined, ApiUrlBuilder.pathPrefix(origin)),
        ),
    );
    const privateBlobs = new PigeonPrivateBlobClient(http, signer, {
      client: (origin) =>
        new HttpJsonClient(new ApiUrlBuilder(origin), { isolated: true }),
      home: ownHome,
      signer: (origin) =>
        new RequestSigner(undefined, ApiUrlBuilder.pathPrefix(origin)),
    });
    const privateBlobReplicator = new PrivateBlobReplicator(
      privateBlobs,
      new PrivateBlobUploadLedger(storage, (session) =>
        scopeClientStorageKey(
          `pigeon:privateBlobUploads:${session.identity.id}`,
        ),
      ),
      {
        attempts: 3,
        now: () => Date.now(),
        retryDelayMs: 500,
        wait: (ms) =>
          new Promise<void>((resolve) => {
            globalThis.setTimeout(resolve, ms);
          }),
      },
    );
    const privateBlobReplicaPlanner = new PrivateBlobReplicaPlanner({
      home: ownHome,
      verifiedRecipientHome: verifiedRecipientBase,
    });
    const publicFiles = new PigeonPublicFilesClient(
      http,
      signer,
      contentReplication,
    );
    const attachmentDownloader = new PigeonAttachmentDownloader(
      publicFiles,
      privateBlobs,
      attachmentCipher,
      new AttachmentBinaryCodec(),
    );
    const attachmentPublicationContexts = new AttachmentPublicationContexts();
    const attachmentBlobUploader = new PigeonAttachmentBlobUploader(
      new PigeonDirectAttachmentUploader(privateBlobReplicator, publicFiles),
      new PigeonChunkedAttachmentUploader(privateBlobReplicator, publicFiles),
    );
    const attachmentRepository = new PigeonAttachmentRepository(
      attachmentDownloader,
      new PigeonMessageAttachmentUploader(
        attachmentCipher,
        attachmentBlobUploader,
        new PublicImageUploadPreparer(),
        new PigeonAttachmentPreviewCreator(
          attachmentCipher,
          attachmentBlobUploader,
          new MessageAttachmentThumbnailPreparer(),
        ),
        privateBlobReplicator,
      ),
      attachmentPublicationContexts,
    );

    this.publishMessageAttachmentUseCase = new PublishMessageAttachment(
      attachmentRepository,
    );
    this.filesGateway = new PigeonFilesGateway(
      attachmentDownloader,
      new PigeonPublicFileUploader(
        publicFiles,
        new PublicImageUploadPreparer(),
      ),
      this.publishMessageAttachmentUseCase,
      new AttachmentFinder(attachmentRepository),
      attachmentPublicationContexts,
      privateBlobReplicaPlanner,
      privateBlobReplicator,
    );

    const identityCommands = new PigeonIdentityCommandsApi(
      http,
      signer,
      identityResourceGateway,
      new IdentitySignaturePayloadFactory(() =>
        MailboxHomeBase.fromApiBase(API_SERVER_URL, window.location.origin),
      ),
      this.identityVault,
    );
    const identitySession = new PigeonIdentitySessionApi(
      identityResourceGateway,
      this.identityVault,
      deviceAuthorization,
      deviceSealedRoot,
      deviceSealedRecovery,
    );
    const identityWorkspace = new PigeonIdentityWorkspaceSessionApi({
      decryptKeychain: (session, keychain) =>
        keychainApi.decrypt(session, keychain),
      listConversations: async (session) =>
        await conversationsApi.list(session),
      loadKeychain: async (session, options) =>
        await keychainApi.loadOptional(session, options),
    });
    const identityLogin = new PigeonIdentityLoginApi(
      identitySession,
      identityWorkspace,
    );
    const conversationCommands = new PigeonConversationCommandsApi({
      conversations: conversationMapper,
      http,
      identities: identityResourceGateway,
      ids: conversationIds,
      keychains: keychainApi,
      mutations,
      operations: new ConversationOperationSigner(mutations),
      requestCache: this.requestCache,
      signer,
    });

    this.conversationsGateway = new PigeonConversationsGateway(
      conversationsApi,
      conversationCommands,
    );
    this.mlsRecords = new PigeonMlsRecordsApi(http, signer, mutations);
    this.communityOperations = new PigeonCommunityOperationsApi(http, signer);
    this.communityGateway = new PigeonCommunitiesGateway(
      communitiesApi,
      new PigeonCommunityInvitationApi(http, signer, communitiesApi, mutations),
      this.requestCache,
      this.filesGateway,
    );

    this.messageProjection = new PigeonMessageProjection(
      messageProjector,
      copy.messages,
    );

    this.conversationDrafts = new PigeonConversationDraftsApi(
      http,
      signer,
      this.requestCache,
    );
    this.linkPreviews = new PigeonLinkPreviewsApi(http, signer);
    this.messageCommands = new PigeonMessageCommandsApi(
      this.linkPreviews,
      this.filesGateway,
      mutations,
    );
    this.mailboxMiner = new LazyMailboxCreationMiner();
    const mailboxChannel = new MailboxChannel(
      new PigeonMailboxClient(http),
      this.mailboxMiner.mine,
    );
    const remoteMailboxChannel = (base: string): MailboxChannel =>
      new MailboxChannel(
        new PigeonMailboxClient(
          new HttpJsonClient(new ApiUrlBuilder(base), { isolated: true }),
        ),
        this.mailboxMiner.mine,
      );
    const listDeviceCredentials = async (session: Session) =>
      (await this.identityGateway.listDevices(session)).map((device) =>
        device.valueOf(),
      );
    const readerSet = new DirectMessageReaderSet(
      mailboxChannel,
      listDeviceCredentials,
    );
    const recipientMailboxes = new RecipientMailboxRouter(
      mailboxChannel,
      verifiedRecipientBase,
      remoteMailboxChannel,
    );
    this.mailboxChannel = mailboxChannel;
    this.recipientMailboxes = recipientMailboxes;
    this.directMessageMailbox = new DirectMessageMailbox(
      mailboxChannel,
      recipientMailboxes,
      new DirectMessageMailboxStore(),
      this.messageProjection,
      readerSet,
      this.messageCommands,
      MailboxAvailabilityServers.pick(
        MAILBOX_AVAILABILITY_SERVERS,
        API_SERVER_URL,
        () => window.location.origin,
      ).map((base) => {
        const channel = remoteMailboxChannel(base);

        return {
          base,
          channel,
          readerSet: new DirectMessageReaderSet(channel, listDeviceCredentials),
          store: new DirectMessageMailboxStore(base),
        };
      }),
    );
    this.node = new PigeonNodeApi(http, signer);
    this.nodeAccess = new PigeonNodeAccessApi(http, signer);
    const notificationsApi = new PigeonNotificationsApi(
      http,
      signer,
      <T>(
        key: string,
        loader: () => Promise<T>,
        options?: RequestCacheOptions,
      ) => this.requestCache.load(key, loader, options),
      mutations,
    );
    const contactPins = new ContactPinStore();

    this.groupConversationMailbox = new GroupConversationMailbox({
      channel: mailboxChannel,
      client: new PigeonMailboxClient(http),
      composer: this.messageCommands,
      contacts: (session) => Object.keys(contactPins.load(session.identity.id)),
      direct: (session) =>
        new GroupMailboxNotificationLink(
          session,
          http,
          signer,
          new NotificationMutationSigner(mutations),
          Date.now,
        ),
      notifications: notificationsApi,
      now: Date.now,
      projector: messageProjector,
      readerSet,
      storage: scopeClientStorageKey('pigeon-group'),
      verifiedDevices: async (session) =>
        (await deviceAuthorization.verifiedDevices(session)).map((device) =>
          device.valueOf(),
        ),
    });
    this.notificationsGateway = new PigeonNotificationsGateway(
      notificationsApi,
      (session) =>
        this.requestCache.invalidateForSession(
          '/notification-settings',
          session,
        ),
    );
    this.pushApi = new PigeonPushApi(http, signer);
    this.pushGateway = new PigeonPushGateway(this.pushApi);
    this.presence = new PigeonPresenceGateway(
      new PigeonPresenceApi(http, signer),
    );
    this.pollsApi = new PigeonPollsApi(http, signer, mutations);
    this.stickersApi = new PigeonStickersApi(
      http,
      signer,
      mutations,
      publicFiles,
      new PublicImageUploadPreparer(),
    );
    this.identityGateway = new PigeonIdentitiesGateway(
      identityCommands,
      identityLogin,
      identityResourceGateway,
      deviceAuthorization,
      keychainApi,
      this.presence,
      deviceSealedRoot,
      deviceSealedRecovery,
      {
        publish: async (session, secret, floor) =>
          await this.directMessageMailbox.publishHistory(
            session,
            secret,
            floor,
          ),
        receive: async (session, secret) =>
          await this.directMessageMailbox.receiveHistory(session, secret),
      },
      {
        enrol: async (session, credential) =>
          await this.directMessageMailbox.enrolDeviceReader(
            session,
            credential.valueOf(),
          ),
      },
    );
  }

  public disposeSessionWorkers(): void {
    this.messageProjection.dispose();
    this.attachmentCipher.dispose();
    this.mailboxMiner.dispose();
  }

  public apiUrl(path: string): string {
    return new ApiUrlBuilder(API_SERVER_URL).build(path);
  }
}
