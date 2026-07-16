import type { CallMediaEncryptionUnavailableReason } from './CallMediaEncryptionUnavailableReason';

export type CallMediaEncryptionState = {
  active: boolean;
  available: boolean;
  enabled: boolean;
  reason?: CallMediaEncryptionUnavailableReason;
};
