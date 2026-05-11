import type { EncryptedKeyPair } from '@haskou/value-objects';

export type IdentityResource = {
  id: string;
  encryptedKeyPair: {
    encryptedPrivateKey: string;
    publicKey: string;
  };
  profile: {
    name: string;
    handle?: string | null;
    biography?: string | null;
    picture?: string | null;
  };
  networks: string[];
  timestamp: number;
  signature: string;
  version: number;
  previousIdentityExternalIdentifier?: string | null;
  identityExternalIdentifier?: string | null;
};

export type IdentityProfile = IdentityResource['profile'];

export type KeychainResource = {
  encryptedPayload: string;
  keychainExternalIdentifier: string;
  ownerIdentityId: string;
  previousKeychainExternalIdentifier?: string | null;
  signature: string;
  timestamp: number;
  version: number;
};

export type ConversationKeyEntry = {
  conversationId: string;
  peerIdentityId: string;
  publicKey: string;
  privateKey: string;
  createdAt: number;
};

export type ConversationInvitationPayload = {
  conversationId: string;
  encryptedConversationKey: string;
  inviterIdentityId: string;
  inviterSignature: string;
  recipientIdentityId: string;
};

export type NotificationResource = {
  createdAt: string;
  id: string;
  payload: ConversationInvitationPayload;
  recipientIdentityId: string;
  state: 'accepted' | 'declined' | 'pending';
  status: 'read' | 'unread';
  type: 'conversation_invitation';
};

export type PublicFileUpload = {
  cid: string;
  contentType: string;
  filename: string;
  size: number;
};

export type PublicFileContent = PublicFileUpload & {
  data: string;
  uploadedAt?: string;
  uploadedByIdentityId?: string;
};

export type PrivateFileUpload = PublicFileUpload & {
  encrypted: true;
};

export type MessageAttachmentEncryption = {
  algorithm: 'AES-GCM';
  iv: string;
  key: string;
};

export type MessageAttachment = {
  cid: string;
  contentType: string;
  encryptedSize?: number;
  encryption: MessageAttachmentEncryption;
  filename: string;
  size: number;
};

export type PendingMessageAttachment = {
  encryptedBytes: ArrayBuffer;
  metadata: Omit<MessageAttachment, 'cid' | 'encryptedSize'>;
  uploadFilename: string;
};

export type LocalKeychain = {
  version: number;
  conversations: Record<string, ConversationKeyEntry>;
};

export type ConversationResource = {
  id: string;
  conversationId?: string;
  participants?: string[];
  participantIdentityIds?: string[];
  participantIds?: string[];
  peerIdentityId?: string;
  title?: string;
  latestMessagePreview?: string;
  latestMessageAt?: number;
  unreadCount?: number;
};

export type MessageResource = {
  attachmentExternalIdentifiers?: string[];
  id?: string;
  messageId?: string;
  authorId?: string;
  conversationId?: string;
  authorIdentityId?: string;
  encryptedPayload?: string;
  payload?: string;
  content?: string;
  signature?: string;
  timestamp?: number;
  createdAt?: number;
  previousMessageIds?: string[];
  targetMessageId?: string;
  type?: string;
};

export type MessageSignaturePayload = {
  attachmentExternalIdentifiers: string[];
  authorId: string;
  conversationId: string;
  createdAt: number;
  encryptedPayload: string;
  id: string;
  previousMessageIds: string[];
  targetMessageId?: string;
  type: 'sent';
};

export type ChatMessage = {
  attachments: MessageAttachment[];
  id: string;
  authorIdentityId: string;
  content: string;
  timestamp: number;
  mine: boolean;
  encrypted: boolean;
  raw: MessageResource;
};

export type Session = {
  identity: IdentityResource;
  encryptedKeyPair: EncryptedKeyPair;
  password: string;
  keychain: LocalKeychain;
  keychainExternalIdentifier?: string | null;
};

export type LoginResult = {
  session: Session;
  conversations: ConversationResource[];
};
