import type { DirectMessageOutboxState } from '../../../../contexts/messages/infrastructure/mailbox/DirectMessageOutboxState';

/**
 * What the security and audit view shows. Only ids and fingerprints: no
 * field ever carries private or symmetric key material.
 */
export type SecurityAudit = {
  account: {
    authorizationEpoch: string;
    authorizationRevision: number;
    deviceCredentialFingerprint: string;
    deviceId: string;
    identityId: string;
    identityKeyFingerprint: string;
    sealedRoot: { fingerprint: string | null; generation: number | null };
  };
  contacts: {
    identityId: string;
    keyFingerprint: string;
    name: string;
    verified: boolean;
  }[];
  conversations: {
    conversationId: string;
    incomingMailboxId: string | null;
    keyFingerprint: string;
    keyVersion: number;
    kind: 'community' | 'conversation';
    outgoingMailboxId: string | null;
    peerIdentityId: string | null;
    title: string;
  }[];
  devices: { credentialFingerprint: string; current: boolean }[] | null;
  groups: {
    communityId: string;
    epoch: string;
    leaves: {
      deviceId: string;
      identityId: string;
      own: boolean;
      signatureKeyFingerprint: string;
    }[];
    title: string;
  }[];
  outbox: {
    conversationId: string;
    createdAt: number;
    envelopeId: string;
    state: DirectMessageOutboxState;
  }[];
};
