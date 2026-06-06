import type { EncryptedKeyPair } from '@haskou/value-objects';

import type {
  ConversationKeyEntry,
  ConversationResource,
} from '../../conversations/domain/conversationResources.types';

export type IdentityResource = {
  encryptedKeyPair: {
    encryptedPrivateKey: string;
    publicKey: string;
  };
  id: string;
  identityExternalIdentifier?: string | null;
  networks: string[];
  previousIdentityExternalIdentifier?: string | null;
  profile: {
    biography?: string | null;
    banner?: string | null;
    handle?: string | null;
    name: string;
    picture?: string | null;
  };
  signature: string;
  timestamp: number;
  version: number;
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
  lastActivityAt?: number;
  lastHeartbeatAt?: number;
  networkIds?: string[];
  status: PresenceStatus;
  updatedAt: number;
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

export type LocalKeychain = {
  conversations: Record<string, ConversationKeyEntry>;
  version: number;
};

export type Session = {
  encryptedKeyPair: EncryptedKeyPair;
  identity: IdentityResource;
  keychain: LocalKeychain;
  keychainExternalIdentifier?: string | null;
  password: string;
};

export type LoginResult = {
  conversations: ConversationResource[];
  session: Session;
};
