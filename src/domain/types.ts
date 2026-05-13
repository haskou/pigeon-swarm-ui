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
    banner?: string | null;
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

export type CommunityInvitationPayload = {
  communityId: string;
  encryptedCommunityKey: string;
  inviterIdentityId: string;
  inviterSignature: string;
  recipientIdentityId: string;
};

export type MissedCallPayload = {
  callId: string;
  callerIdentityId: string;
  networkId: string;
  recipientIdentityId: string;
};

type BaseNotificationResource = {
  createdAt: string;
  id: string;
  recipientIdentityId: string;
  state: 'accepted' | 'declined' | 'pending';
  status: 'read' | 'unread';
};

export type ConversationInvitationNotificationResource =
  BaseNotificationResource & {
    payload: ConversationInvitationPayload;
    type: 'conversation_invitation' | 'group_conversation_invitation';
  };

export type CommunityInvitationNotificationResource =
  BaseNotificationResource & {
    payload: CommunityInvitationPayload;
    type: 'community_invitation';
  };

export type MissedCallNotificationResource = BaseNotificationResource & {
  payload: MissedCallPayload;
  type: 'missed_call';
};

export type NotificationResource =
  | CommunityInvitationNotificationResource
  | ConversationInvitationNotificationResource
  | MissedCallNotificationResource;

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

export type PrivateFileContent = PrivateFileUpload & {
  encryptedData: string;
  uploadedAt?: number | string;
  uploadedByIdentityId?: string;
};

export type MessageAttachmentEncryption = {
  algorithm: 'AES-GCM';
  chunks?: { iv: string; size: number }[];
  chunkSize?: number;
  iv: string;
  key: string;
};

export type MessageAttachment = {
  cid: string;
  chunks?: Array<{
    cid: string;
    index: number;
    sha256: string;
    size: number;
  }>;
  contentType: string;
  encryptedSize?: number;
  encryption: MessageAttachmentEncryption;
  filename: string;
  size: number;
  type?: 'chunked_file';
};

export type MessageReplyPreview = {
  authorIdentityId: string;
  content?: string;
  image?: MessageAttachment;
  messageId: string;
};

export type PendingMessageAttachment = {
  encryptedBytes: ArrayBuffer;
  metadata: Omit<MessageAttachment, 'cid' | 'encryptedSize'>;
  uploadFilename: string;
};

export type AttachmentProgress = {
  filename: string;
  percent: number;
  phase: 'decrypt' | 'encrypt' | 'upload';
};

export type SendMessageOptions = {
  attachments?: File[];
  onAttachmentProgress?: (progress: AttachmentProgress) => void;
  previousMessageIds?: string[];
  replyPreview?: MessageReplyPreview;
  replyToMessageId?: string;
};

export type LocalKeychain = {
  version: number;
  conversations: Record<string, ConversationKeyEntry>;
};

export type ConversationResource = {
  id: string;
  conversationId?: string;
  networkId: string;
  name?: string;
  participants?: string[];
  participantIdentityIds?: string[];
  participantIds?: string[];
  peerIdentityId?: string;
  title?: string;
  type?: 'group' | 'one-to-one';
  latestMessagePreview?: string;
  latestMessageAt?: number;
  unreadCount?: number;
};

export type CommunityTextChannel = {
  id: string;
  name: string;
  type: 'text';
  createdAt: number;
};

export type Community = {
  id: string;
  networkId: string;
  ownerIdentityId: string;
  name: string;
  description: string;
  avatar?: string | null;
  banner?: string | null;
  memberIds: string[];
  textChannels: CommunityTextChannel[];
  visibility: 'private';
  createdAt: number;
};

export type MessageResource = {
  attachmentExternalIdentifiers?: string[];
  id?: string;
  messageId?: string;
  authorId?: string;
  conversationId?: string;
  communityId?: string;
  channelId?: string;
  authorIdentityId?: string;
  encryptedPayload?: string;
  payload?: string;
  content?: string;
  signature?: string;
  timestamp?: number;
  createdAt?: number;
  previousMessageIds?: string[];
  replyToMessageId?: string;
  targetMessageId?: string;
  type?: string;
};

export type MessageSignaturePayload = {
  attachmentExternalIdentifiers: string[];
  authorId: string;
  conversationId: string;
  createdAt: number;
  encryptedPayload?: string;
  id: string;
  previousMessageIds: string[];
  replyToMessageId?: string;
  targetMessageId?: string;
  type: 'deleted' | 'sent';
};

export type ChatMessage = {
  attachmentProgress?: AttachmentProgress;
  attachments: MessageAttachment[];
  id: string;
  authorIdentityId: string;
  content: string;
  deliveryStatus?: 'failed' | 'pending';
  timestamp: number;
  mine: boolean;
  encrypted: boolean;
  replyPreview?: MessageReplyPreview;
  replyToMessageId?: string;
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
