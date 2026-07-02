export type CallMediaEncryptionUnavailableReason =
  | 'disabled'
  | 'missing-key'
  | 'public-community'
  | 'unsupported';

export type CallMediaEncryptionState = {
  active: boolean;
  available: boolean;
  enabled: boolean;
  reason?: CallMediaEncryptionUnavailableReason;
};
