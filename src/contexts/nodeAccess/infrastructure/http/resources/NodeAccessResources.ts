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

/** The owner's block list document, signed over all but the signature. */
export interface SignedNodeBlockListResource {
  blockedIdentityIds: string[];
  blockedNodePeerIds: string[];
  identitySignature: string;
  issuedAt: number;
  ownerIdentityId: string;
  type: 'pigeon-node-block-list';
  version: number;
}

export type NodeBlockSourceFetchOutcomeResource =
  | 'accepted'
  | 'invalid-document'
  | 'invalid-signature'
  | 'not-newer'
  | 'redirected'
  | 'refused-address'
  | 'too-large'
  | 'unreachable'
  | 'wrong-signer';

export interface NodeBlockSourceResource {
  appliedCount: number;
  autoApply: boolean;
  lastFetchedAt: number | null;
  lastFetchOutcome: NodeBlockSourceFetchOutcomeResource | null;
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

export interface NodeBlockSourcesPageResource {
  nextCursor: string | null;
  sources: NodeBlockSourceResource[];
}

export interface NodeRegistrationCodesPageResource {
  codes: NodeRegistrationCodeResource[];
  nextCursor: string | null;
}

/** One page of pending entries; each array pages on its own cursor. */
export interface PendingNodeBlockEntriesPageResource {
  blockedIdentityIds: string[];
  blockedIdentityIdsNextCursor: string | null;
  blockedNodePeerIds: string[];
  blockedNodePeerIdsNextCursor: string | null;
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
