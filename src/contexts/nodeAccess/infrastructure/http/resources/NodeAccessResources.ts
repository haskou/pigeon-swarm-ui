export type NodeRegistrationModeResource = 'closed' | 'codes' | 'open';

export interface NodeAccessInfoResource {
  id: string;
  registration: { mode: NodeRegistrationModeResource };
}

export interface NodeRegistrationCodeResource {
  expiresAt: number;
  id: string;
  maxUses: number;
  usesLeft: number;
}

export interface IssuedNodeRegistrationCodeResource {
  code: string;
  expiresAt: number;
  id: string;
  maxUses: number;
}

/** The node owner's block list document, signed over everything but the signature. */
export interface SignedNodeBlockListResource {
  blockedIdentityIds: string[];
  blockedNodePeerIds: string[];
  identitySignature: string;
  issuedAt: number;
  ownerIdentityId: string;
  type: 'pigeon-node-block-list';
  version: number;
}

export interface NodeBlockSourceResource {
  appliedCount: number;
  autoApply: boolean;
  lastFetchedAt: number | null;
  lastFetchOutcome: string | null;
  origin: string;
  ownerIdentityId: string;
  pendingCount: number;
  version: number | null;
}

export interface PendingNodeBlockEntriesResource {
  blockedIdentityIds: string[];
  blockedNodePeerIds: string[];
  ownerIdentityId: string;
  version: number | null;
}

export interface NodeBlockApprovalResource {
  all: boolean;
  blockedIdentityIds?: string[];
  blockedNodePeerIds?: string[];
  version: number;
}

export interface NodeBlockExceptionsResource {
  identityIds: string[];
  nodePeerIds: string[];
}
