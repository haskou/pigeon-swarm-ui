import type { CallSession } from '../../../../contexts/calls/presentation/view-models/CallSession';

/** What the rekey poll reads of the active call. */
export type CallMediaRekeyCall = Pick<
  CallSession,
  'channelId' | 'communityId' | 'id' | 'kind' | 'mediaEncryption'
>;
