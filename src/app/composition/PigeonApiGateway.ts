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
import { PigeonPrivateFilesClient } from '../../contexts/attachments/infrastructure/http/PigeonPrivateFilesClient';
import { PigeonPublicFilesClient } from '../../contexts/attachments/infrastructure/http/PigeonPublicFilesClient';
import { PigeonPublicFileUploader } from '../../contexts/attachments/infrastructure/http/PigeonPublicFileUploader';
import { MessageAttachmentThumbnailPreparer } from '../../contexts/attachments/infrastructure/media/MessageAttachmentThumbnailPreparer';
import { PublicImageUploadPreparer } from '../../contexts/attachments/infrastructure/media/PublicImageUploadPreparer';
import { CallEventSigner } from '../../contexts/calls/infrastructure/http/CallEventSigner';
import { PigeonCallsApi } from '../../contexts/calls/infrastructure/http/PigeonCallsApi';
import { PigeonCommunitiesApi } from '../../contexts/communities/infrastructure/http/PigeonCommunitiesApi';
import { PigeonCommunitiesGateway } from '../../contexts/communities/infrastructure/http/PigeonCommunitiesGateway';
import { PigeonCommunityInvitationApi } from '../../contexts/communities/infrastructure/http/PigeonCommunityInvitationApi';
import { ConversationIdFactory } from '../../contexts/conversations/domain/ConversationIdFactory';
import { ConversationMapper } from '../../contexts/conversations/infrastructure/http/ConversationMapper';
import { ConversationOperationSigner } from '../../contexts/conversations/infrastructure/http/ConversationOperationSigner';
import { PigeonConversationCommandsApi } from '../../contexts/conversations/infrastructure/http/PigeonConversationCommandsApi';
import { PigeonConversationsApi } from '../../contexts/conversations/infrastructure/http/PigeonConversationsApi';
import { PigeonConversationsGateway } from '../../contexts/conversations/infrastructure/http/PigeonConversationsGateway';
import { KeychainCipher } from '../../contexts/identities/infrastructure/crypto/KeychainCipher';
import { IdentitySignaturePayloadFactory } from '../../contexts/identities/infrastructure/http/IdentitySignaturePayloadFactory';
import { PigeonDeviceAuthorizationApi } from '../../contexts/identities/infrastructure/http/PigeonDeviceAuthorizationApi';
import { PigeonIdentitiesGateway } from '../../contexts/identities/infrastructure/http/PigeonIdentitiesGateway';
import { PigeonIdentityCommandsApi } from '../../contexts/identities/infrastructure/http/PigeonIdentityCommandsApi';
import { PigeonIdentityGateway } from '../../contexts/identities/infrastructure/http/PigeonIdentityGateway';
import { PigeonIdentityLoginApi } from '../../contexts/identities/infrastructure/http/PigeonIdentityLoginApi';
import { PigeonIdentitySessionApi } from '../../contexts/identities/infrastructure/http/PigeonIdentitySessionApi';
import { PigeonIdentityWorkspaceSessionApi } from '../../contexts/identities/infrastructure/http/PigeonIdentityWorkspaceSessionApi';
import { PigeonKeychainApi } from '../../contexts/identities/infrastructure/http/PigeonKeychainApi';
import { PigeonPresenceApi } from '../../contexts/identities/infrastructure/http/PigeonPresenceApi';
import { PigeonPresenceGateway } from '../../contexts/identities/infrastructure/http/PigeonPresenceGateway';
import { DeviceIdentityVault } from '../../contexts/identities/infrastructure/storage/DeviceIdentityVault';
import { DraftPayloadCipher } from '../../contexts/messages/infrastructure/crypto/DraftPayloadCipher';
import { MessageProjector } from '../../contexts/messages/infrastructure/crypto/MessageProjector';
import { PigeonMessageProjection } from '../../contexts/messages/infrastructure/crypto/PigeonMessageProjection';
import { PigeonMessageCommandsApi } from '../../contexts/messages/infrastructure/http/PigeonMessageCommandsApi';
import { PigeonMessagesApi } from '../../contexts/messages/infrastructure/http/PigeonMessagesApi';
import { PigeonMessagesGateway } from '../../contexts/messages/infrastructure/http/PigeonMessagesGateway';
import { PigeonNodeApi } from '../../contexts/networks/infrastructure/http/PigeonNodeApi';
import { PigeonNotificationsApi } from '../../contexts/notifications/infrastructure/http/PigeonNotificationsApi';
import { PigeonNotificationsGateway } from '../../contexts/notifications/infrastructure/http/PigeonNotificationsGateway';
import { PigeonPushApi } from '../../contexts/notifications/infrastructure/http/PigeonPushApi';
import { PigeonPushGateway } from '../../contexts/notifications/infrastructure/http/PigeonPushGateway';
import { PigeonPollsApi } from '../../contexts/polls/infrastructure/http/PigeonPollsApi';
import { PigeonStickersApi } from '../../contexts/stickers/infrastructure/http/PigeonStickersApi';
import { PublicMutationSigner } from '../../shared/infrastructure/crypto/PublicMutationSigner';
import { ApiUrlBuilder } from '../../shared/infrastructure/http/ApiUrlBuilder';
import { HttpJsonClient } from '../../shared/infrastructure/http/HttpJsonClient';
import { RequestCache } from '../../shared/infrastructure/http/RequestCache';
import { RequestSigner } from '../../shared/infrastructure/http/RequestSigner';
import { copy } from '../../shared/presentation/i18n/copy';
import { API_SERVER_URL } from '../API_SERVER_URL';

export class PigeonApiGateway {
  private readonly requestCache = new RequestCache();

  public readonly calls: PigeonCallsApi;

  public readonly communityGateway: PigeonCommunitiesGateway;

  public readonly conversationsGateway: PigeonConversationsGateway;

  public readonly filesGateway: PigeonFilesGateway;

  public readonly identityGateway: PigeonIdentitiesGateway;

  public readonly identityVault: DeviceIdentityVault;

  public readonly messageCommands: PigeonMessageCommandsApi;

  public readonly messagesApi: PigeonMessagesApi;

  public readonly messagesGateway: PigeonMessagesGateway;

  public readonly node: PigeonNodeApi;

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
    keychainCipher: KeychainCipher = new KeychainCipher(),
    conversationIds: ConversationIdFactory = new ConversationIdFactory(),
    attachmentCipher: AttachmentCipher = AttachmentCipher.inCurrentThread(),
  ) {
    const communitiesApi = new PigeonCommunitiesApi(
      http,
      signer,
      <T>(
        key: string,
        loader: () => Promise<T>,
        options?: RequestCacheOptions,
      ) => this.requestCache.load(key, loader, options),
      new DraftPayloadCipher(),
      (key: string) => this.requestCache.invalidate(key),
    );
    const conversationsApi = new PigeonConversationsApi(
      http,
      signer,
      conversationMapper,
    );
    this.calls = new PigeonCallsApi(http, signer, new CallEventSigner(), {
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
    });
    const contentReplication = new PigeonContentReplicationClient(http, signer);
    const privateFiles = new PigeonPrivateFilesClient(
      http,
      signer,
      contentReplication,
    );
    const publicFiles = new PigeonPublicFilesClient(
      http,
      signer,
      contentReplication,
    );
    const attachmentDownloader = new PigeonAttachmentDownloader(
      privateFiles,
      publicFiles,
      attachmentCipher,
      new AttachmentBinaryCodec(),
    );
    const attachmentPublicationContexts = new AttachmentPublicationContexts();
    const attachmentBlobUploader = new PigeonAttachmentBlobUploader(
      new PigeonDirectAttachmentUploader(privateFiles, publicFiles),
      new PigeonChunkedAttachmentUploader(privateFiles, publicFiles),
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
      ),
      attachmentPublicationContexts,
    );

    this.publishMessageAttachmentUseCase = new PublishMessageAttachment(
      attachmentRepository,
    );
    this.filesGateway = new PigeonFilesGateway(
      attachmentDownloader,
      privateFiles,
      new PigeonPublicFileUploader(
        publicFiles,
        new PublicImageUploadPreparer(),
      ),
      this.publishMessageAttachmentUseCase,
      new AttachmentFinder(attachmentRepository),
      attachmentPublicationContexts,
    );

    const identityResourceGateway = new PigeonIdentityGateway(http);

    this.identityVault = new DeviceIdentityVault();
    const identityCommands = new PigeonIdentityCommandsApi(
      http,
      signer,
      identityResourceGateway,
      new IdentitySignaturePayloadFactory(),
      this.identityVault,
    );
    const deviceAuthorization = new PigeonDeviceAuthorizationApi(
      http,
      signer,
      this.identityVault,
    );
    const keychainApi = new PigeonKeychainApi(
      http,
      signer,
      keychainCipher,
      this.requestCache,
    );
    const identitySession = new PigeonIdentitySessionApi(
      identityResourceGateway,
      this.identityVault,
      deviceAuthorization,
    );
    const identityWorkspace = new PigeonIdentityWorkspaceSessionApi({
      decryptKeychain: (session, keychain) =>
        keychainApi.decrypt(session, keychain),
      listConversations: async (session) =>
        await conversationsApi.list(session),
      loadKeychain: async (session) => await keychainApi.loadOptional(session),
    });
    const identityLogin = new PigeonIdentityLoginApi(
      identitySession,
      identityWorkspace,
    );
    const conversationCommands = new PigeonConversationCommandsApi(
      http,
      signer,
      conversationMapper,
      conversationIds,
      identityResourceGateway,
      keychainApi,
      this.requestCache,
      new ConversationOperationSigner(),
    );

    this.conversationsGateway = new PigeonConversationsGateway(
      conversationsApi,
      conversationCommands,
    );
    this.communityGateway = new PigeonCommunitiesGateway(
      communitiesApi,
      new PigeonCommunityInvitationApi(
        http,
        signer,
        communitiesApi,
        identityResourceGateway,
        keychainApi,
      ),
      this.requestCache,
      this.filesGateway,
    );

    const messageProjection = new PigeonMessageProjection(
      messageProjector,
      copy.messages,
    );

    this.messagesApi = new PigeonMessagesApi(
      http,
      signer,
      this.requestCache,
      messageProjection,
    );
    this.messageCommands = new PigeonMessageCommandsApi(
      http,
      signer,
      this.messagesApi,
      messageProjection,
      this.filesGateway,
      new PublicMutationSigner(),
    );
    this.messagesGateway = new PigeonMessagesGateway(
      this.messagesApi,
      this.messageCommands,
    );
    this.node = new PigeonNodeApi(http, signer);
    this.notificationsGateway = new PigeonNotificationsGateway(
      new PigeonNotificationsApi(
        http,
        signer,
        <T>(
          key: string,
          loader: () => Promise<T>,
          options?: RequestCacheOptions,
        ) => this.requestCache.load(key, loader, options),
      ),
      (session) =>
        this.requestCache.invalidateForSession(
          '/notification-settings/',
          session,
        ),
    );
    this.pushApi = new PigeonPushApi(http, signer);
    this.pushGateway = new PigeonPushGateway(this.pushApi);
    this.presence = new PigeonPresenceGateway(
      new PigeonPresenceApi(http, signer),
      this.requestCache,
    );
    this.pollsApi = new PigeonPollsApi(http, signer);
    this.stickersApi = new PigeonStickersApi(
      http,
      signer,
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
    );
  }

  public apiUrl(path: string): string {
    return new ApiUrlBuilder(API_SERVER_URL).build(path);
  }
}
