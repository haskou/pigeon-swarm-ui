import type { PublicMutationSigner } from '../../../../shared/infrastructure/crypto/PublicMutationSigner';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestCache } from '../../../../shared/infrastructure/http/RequestCache';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { ConversationIdFactory } from '../../domain/ConversationIdFactory';
import type { ConversationIdentityReader } from './ConversationIdentityReader';
import type { ConversationKeychainPublisher } from './ConversationKeychainPublisher';
import type { ConversationMapper } from './ConversationMapper';
import type { ConversationOperationSigner } from './ConversationOperationSigner';

export interface PigeonConversationCommandsApiDependencies {
  http: HttpJsonClient;
  signer: RequestSigner;
  conversations: ConversationMapper;
  ids: ConversationIdFactory;
  identities: ConversationIdentityReader;
  keychains: ConversationKeychainPublisher;
  requestCache: RequestCache;
  operations: ConversationOperationSigner;
  mutations: PublicMutationSigner;
}
