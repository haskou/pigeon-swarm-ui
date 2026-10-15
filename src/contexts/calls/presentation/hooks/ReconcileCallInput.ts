import type { StartCallInput } from './StartCallInput';

export type ReconcileCallInput = Omit<
  StartCallInput,
  | 'call'
  | 'currentIdentityId'
  | 'id'
  | 'loadIceConfig'
  | 'mediaEncryptionKey'
  | 'mediaEncryptionUnavailableReason'
  | 'noiseCancellationEnabled'
  | 'onSignal'
>;
