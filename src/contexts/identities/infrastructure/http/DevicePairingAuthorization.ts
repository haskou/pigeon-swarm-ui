import type { DevicePairingCompletion } from '../../domain/DevicePairingCompletion';
import type { Session } from '../session/Session';

export interface DevicePairingAuthorization {
  completion: DevicePairingCompletion;
  session: Session;
}
