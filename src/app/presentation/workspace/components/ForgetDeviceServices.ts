import type { OwnDeviceRetirement } from '../../../../contexts/identities/infrastructure/http/PigeonDeviceAuthorizationApi';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

export type ForgetDeviceServices = {
  directMessages: {
    cancelOutbox(identityId: string): Promise<void>;
    forgetHistory(identityId: string): Promise<void>;
    releaseDeviceReaders(session: Session): Promise<void>;
  };
  identities: {
    forgetDeviceUnlock(identityId: string): Promise<void>;
    retireOwnDevice(session: Session): Promise<OwnDeviceRetirement>;
  };
};
