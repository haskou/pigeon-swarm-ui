import type { CallSignalType } from '../media/CallSignalType';

export type CallSignalScopeType = 'community_channel' | 'conversation';

export type CallSignalSealedEntry = {
  envelope: string;
  recipientDeviceCredential: string;
};

/** The wire object of a call signal before the sender's signature. */
export type UnsignedCallSignal = {
  callId: string;
  createdAt: number;
  expiresAt: number;
  networkId: string;
  recipientIdentityId: string;
  scopeType: CallSignalScopeType;
  sealedEntries: CallSignalSealedEntry[];
  senderDeviceCredential: string;
  senderIdentityId: string;
  signalId: string;
  signalType: CallSignalType;
};

/** What the node stores and fans out; it carries no plaintext payload. */
export type SealedCallSignal = UnsignedCallSignal & { signature: string };

/** The part of a device sealing record its credential signs. */
export type DeviceSealingRecordClaim = {
  deviceCredential: string;
  identityId: string;
  sealingPublicKey: string;
  utcDay: string;
};
