import type { StartCallInput } from './StartCallInput';

export type ReconcileCallInput = Omit<
  StartCallInput,
  | 'call'
  | 'currentIdentityId'
  | 'id'
  | 'loadIceConfig'
  | 'mediaEncryptionEnabled'
  | 'mediaEncryptionKey'
  | 'mediaEncryptionUnavailableReason'
  | 'noiseCancellationEnabled'
  | 'onSignal'
>;
