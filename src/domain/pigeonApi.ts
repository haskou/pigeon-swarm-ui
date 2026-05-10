import type {
  ChatMessage,
  ConversationResource,
  IdentityResource,
  KeychainResource,
  LocalKeychain,
  LoginResult,
  MessageResource,
  Session,
} from './types';

import { API_SERVER_URL } from '../config';
import { ApiUrlBuilder } from './api/ApiUrlBuilder';
import { ConversationIdFactory } from './api/ConversationIdFactory';
import { PigeonApiClient } from './api/PigeonApiClient';

const client = new PigeonApiClient();

export const apiUrl = (path: string): string =>
  new ApiUrlBuilder(API_SERVER_URL).build(path);

export const createConversation = async (
  session: Session,
  peerIdentityId: string,
): Promise<{
  conversation: ConversationResource;
  keychain: LocalKeychain;
  keychainExternalIdentifier: string;
}> => await client.createConversation(session, peerIdentityId);

export const createIdentity = async (
  name: string,
  password: string,
  networks: string[],
): Promise<IdentityResource> =>
  await client.createIdentity(name, password, networks);

export const decryptKeychain = async (
  session: Session,
  keychain: KeychainResource,
): Promise<LocalKeychain> => await client.decryptKeychain(session, keychain);

export const decryptMessage = async (
  session: Session,
  conversationId: string,
  message: MessageResource,
): Promise<ChatMessage> =>
  await client.decryptMessage(session, conversationId, message);

export const deterministicConversationId = (
  leftIdentityId: string,
  rightIdentityId: string,
): string =>
  new ConversationIdFactory().create(leftIdentityId, rightIdentityId);

export const getIdentity = async (
  identityId: string,
): Promise<IdentityResource> => await client.getIdentity(identityId);

export const listConversations = async (
  session: Session,
): Promise<ConversationResource[]> => await client.listConversations(session);

export const loadMessages = async (
  session: Session,
  conversationId: string,
  before?: null | string,
): Promise<{ messages: ChatMessage[]; nextCursor?: null | string }> =>
  await client.loadMessages(session, conversationId, before);

export const loadRemoteKeychain = async (
  session: Session,
): Promise<KeychainResource> => await client.loadRemoteKeychain(session);

export const login = async (
  identityId: string,
  password: string,
): Promise<LoginResult> => await client.login(identityId, password);

export const publishKeychain = async (
  session: Session,
  nextKeychain: LocalKeychain,
): Promise<{ keychain: LocalKeychain; keychainExternalIdentifier: string }> =>
  await client.publishKeychain(session, nextKeychain);

export const register = async (
  name: string,
  password: string,
  networks: string[],
): Promise<LoginResult> => await client.register(name, password, networks);

export const sendMessage = async (
  session: Session,
  conversationId: string,
  content: string,
): Promise<ChatMessage> =>
  await client.sendMessage(session, conversationId, content);
