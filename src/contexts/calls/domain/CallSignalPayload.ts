import type { CallSignalType } from './CallSignalType';

export type CallSignalPayload = {
  payload: Record<string, unknown>;
  recipientIdentityId: string;
  signalType: CallSignalType;
};
