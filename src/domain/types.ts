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

export type PresenceStatus =
  | 'available'
  | 'away'
  | 'busy'
  | 'disconnected'
  | 'invisible';

export type SelectablePresenceStatus = Exclude<PresenceStatus, 'disconnected'>;

export type IdentityPresence = {
  identityId: string;
  status: PresenceStatus;
  updatedAt: number;
  lastActivityAt?: number;
  lastHeartbeatAt?: number;
  networkIds?: string[];
};

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

export type CommunityInviteLinkResource = {
  communityId?: string;
  expiresAt?: string | null;
  inviteToken?: string;
  maxUses?: number;
  token?: string;
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
  blob: Blob;
  uploadedAt?: string;
  uploadedByIdentityId?: string;
};

export type StickerType = 'animated' | 'static' | 'video';

export type StickerDimensions = {
  height: number;
  width: number;
};

export type StickerResource = {
  assetCid: string;
  contentType: string;
  dimensions: StickerDimensions;
  emojis: string[];
  id: string;
  name: string;
  sizeBytes: number;
  type: StickerType;
  createdAt?: number;
  updatedAt?: number;
};

export type StickerPackResource = {
  createdAt?: number;
  description: string;
  id: string;
  name: string;
  ownerIdentityId: string;
  stickers: StickerResource[];
  updatedAt?: number;
};

export type StickerPackInput = {
  description: string;
  name: string;
};

export type StickerInput = {
  assetCid: string;
  contentType: string;
  dimensions: StickerDimensions;
  emojis: string[];
  name: string;
  sizeBytes: number;
  type: StickerType;
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
  encrypted?: boolean;
  encryptedSize?: number;
  encryption?: MessageAttachmentEncryption;
  filename: string;
  size: number;
  storage?: 'private' | 'public';
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
  phase: 'decrypt' | 'download' | 'encrypt' | 'upload';
};

export type AttachmentUploadOptions = {
  encryptLargeAttachments?: boolean;
};

export type SendMessageOptions = {
  attachments?: File[];
  attachmentUpload?: AttachmentUploadOptions;
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

export type CommunityVoiceChannel = {
  connectedIdentityIds?: string[];
  id: string;
  name: string;
  type: 'voice';
  createdAt: number;
};

export type CommunityChannel = CommunityTextChannel | CommunityVoiceChannel;

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
  voiceChannels?: CommunityVoiceChannel[];
  createdAt: number;
};

export type CommunityMembershipRequestStatus =
  | 'accepted'
  | 'declined'
  | 'pending';

export type CommunityMembershipRequestType = 'invitation' | 'request';

export type CommunityMembershipRequest = {
  id: string;
  communityId: string;
  creatorIdentityId: string;
  identityId: string;
  type: CommunityMembershipRequestType;
  status: CommunityMembershipRequestStatus;
  createdAt: number | string;
  updatedAt: number | string;
};

export type CommunityDiscoveryResource = {
  id: string;
  networkId: string;
  ownerIdentityId: string;
  name: string;
  description: string;
  avatar?: string | null;
  banner?: string | null;
  memberCount: number;
  membershipStatus: 'invited' | 'member' | 'none' | 'requested';
  membershipRequest?: CommunityMembershipRequest;
  visibility: 'private';
};

export type IpfsReplicationNetworkStatus = {
  networkId: string;
  activeNodeCount: number;
  desiredReplicas: number;
  knownReplicas: number;
  knownReplicaNodeIds: string[];
  localResponsible: boolean;
  releaseLocalReplica: boolean;
  responsibleNodeIds: string[];
};

export type IpfsReplicationContentStatus = {
  cid: string;
  context: string;
  sizeBytes: number;
  priority: string;
  ownerIdentityId: string;
  createdAt: number;
  updatedAt: number;
  networks: IpfsReplicationNetworkStatus[];
};

export type IpfsReplicationStatus = {
  localNodeId: string;
  contents: IpfsReplicationContentStatus[];
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
  callEventType?: 'declined' | 'ended' | 'missed';
  callId?: string;
  actorIdentityId?: string;
  durationMs?: number;
  previousMessageIds?: string[];
  reactions?: MessageReaction[];
  replyToMessageId?: string;
  targetMessageId?: string;
  type?: string;
};

export type MessageReaction = {
  authorIdentityId: string;
  createdAt: number;
  emoji: string;
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
  kind?: 'call-event' | 'message';
  deliveryStatus?: 'failed' | 'pending';
  timestamp: number;
  mine: boolean;
  encrypted: boolean;
  replyPreview?: MessageReplyPreview;
  replyToMessageId?: string;
  raw: MessageResource;
  reactions: MessageReaction[];
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
