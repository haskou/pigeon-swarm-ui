import type { CallMediaEncryptionUnavailableReason } from './CallMediaEncryptionUnavailableReason';

export type CallMediaEncryptionState = {
  active: boolean;
  reason?: CallMediaEncryptionUnavailableReason;
};
