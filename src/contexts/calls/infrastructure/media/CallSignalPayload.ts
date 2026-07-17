export type CallSignalPayload = {
  payload: Record<string, unknown>;
  recipientIdentityId: string;
  signalType: 'answer' | 'ice_candidate' | 'offer';
};
