import type { DeviceCredential } from '../../domain/value-objects/DeviceCredential';
import type { Session } from '../session/Session';

/**
 * Enrols a newly paired device's reader in this identity's direct inboxes, so
 * a message another device acknowledges before the new device first opens an
 * inbox is still kept for it. Never throws.
 */
export interface DevicePairingReaders {
  enrol(session: Session, credential: DeviceCredential): Promise<void>;
}
