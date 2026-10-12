import type { CallSignalType } from '../../../../contexts/calls/infrastructure/media/CallSignalType';

export type ReceivedCallSignal = {
  expiresAt: number;
  payload: Record<string, unknown>;
  senderIdentityId: string;
  signalId: string;
  signalType: CallSignalType;
};
