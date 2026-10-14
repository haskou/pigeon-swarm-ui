import type { Session } from '../../contexts/identities/infrastructure/session/Session';

export type DeviceRemovalWatchListener = {
  /** A check verified a newer head that still authorizes this device. */
  onAdvanced(from: Session, to: Session): void;
  /** A check verified a signed removal of this device from the identity. */
  onRemoved(identityId: string): void;
};
