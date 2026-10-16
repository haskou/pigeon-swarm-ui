import type { CallMediaRekeyCall } from './CallMediaRekeyCall';
import type { CallMediaRekeyTarget } from './CallMediaRekeyTarget';

/**
 * The call to rekey as its MLS group moves epochs: only an encrypted
 * community voice call. A public community call carries no media key and a
 * conversation call keeps the conversation key, epoch 0, for its lifetime.
 */
export function callMediaRekeyTargetOf(
  call: CallMediaRekeyCall | null,
): CallMediaRekeyTarget | null {
  if (
    call?.kind !== 'community-voice' ||
    !call.mediaEncryption.active ||
    !call.communityId ||
    !call.channelId
  ) {
    return null;
  }

  return {
    callId: call.id,
    channelId: call.channelId,
    communityId: call.communityId,
  };
}
