import type { OwnDeviceRetirement } from '../../../../contexts/identities/infrastructure/http/PigeonDeviceAuthorizationApi';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { ForgetDeviceServices } from './ForgetDeviceServices';

export type ForgetDeviceOutcome =
  | 'forgotten'
  | 'only-device'
  | 'revoke-failed'
  | 'unlock-failed';

/**
 * Revokes this device's own credential first, so local state is removed only
 * after the node confirms the revocation. The node never revokes the only
 * credential of an identity: that case returns 'only-device' with nothing
 * changed, unless the user already confirmed. A confirmed forget of the only
 * device removes the local unlock alone, and keeps the device authorized and
 * its reader in place. Reader release is best effort.
 * Local direct history and queued one-to-one sends are wiped once the gate
 * passes, even when the unlock removal fails.
 */
export async function forgetCurrentDevice(
  session: Session,
  services: ForgetDeviceServices,
  allowOnlyDevice: boolean,
): Promise<ForgetDeviceOutcome> {
  let retirement: OwnDeviceRetirement;
  try {
    retirement = await services.identities.retireOwnDevice(session);
  } catch {
    return 'revoke-failed';
  }

  if (retirement === 'last-device') {
    if (!allowOnlyDevice) return 'only-device';
  } else {
    await services.directMessages.releaseDeviceReaders(session);
  }

  await services.directMessages.forgetHistory(session.identity.id);
  await services.directMessages.cancelOutbox(session.identity.id);

  try {
    await services.identities.forgetDeviceUnlock(session.identity.id);
  } catch {
    return 'unlock-failed';
  }

  return 'forgotten';
}
