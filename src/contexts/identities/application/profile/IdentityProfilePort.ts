import type {
  IdentityResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { IdentityUpdateProfileInput } from '../../domain/IdentitySignaturePayloadFactory';

export interface IdentityProfilePort {
  getIdentity(identityId: string): Promise<IdentityResource>;
  refreshIdentity(identityId: string): Promise<IdentityResource>;
  updateIdentityProfile(
    session: Session,
    profile: IdentityUpdateProfileInput,
    newPassword?: string,
    options?: {
      currentPassword?: string;
      passkeyPrfEnabled?: boolean;
      recoveryKey?: string;
    },
  ): Promise<IdentityResource>;
}
