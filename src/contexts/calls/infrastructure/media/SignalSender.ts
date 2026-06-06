import type { CallSignalType } from '../../domain/callSession.types';

export type SignalSender = (
  recipientIdentityId: string,
  signalType: CallSignalType,
  payload: Record<string, unknown>,
) => Promise<void>;
