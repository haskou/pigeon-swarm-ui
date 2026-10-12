import type { CallSignalType } from '../../../../contexts/calls/infrastructure/media/CallSignalType';

export type SignalSender = (
  recipientIdentityId: string,
  signalType: CallSignalType,
  payload: Record<string, unknown>,
) => Promise<void>;
