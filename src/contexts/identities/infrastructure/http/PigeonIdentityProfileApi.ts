import type {
  IdentityResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { IdentityProfilePort } from '../../application/profile/IdentityProfilePort';
import type { IdentityUpdateProfileInput } from '../../domain/IdentitySignaturePayloadFactory';

import { PigeonIdentityCommandsApi } from './PigeonIdentityCommandsApi';
import { PigeonIdentityGateway } from './PigeonIdentityGateway';

export class PigeonIdentityProfileApi implements IdentityProfilePort {
  public constructor(
    private readonly identity: PigeonIdentityGateway,
    private readonly commands: PigeonIdentityCommandsApi,
  ) {}

  public async getIdentity(identityId: string): Promise<IdentityResource> {
    return await this.identity.get(identityId);
  }

  public async refreshIdentity(identityId: string): Promise<IdentityResource> {
    return await this.identity.refresh(identityId);
  }

  public async updateIdentityProfile(
    session: Session,
    profile: IdentityUpdateProfileInput,
    newPassword?: string,
    options?: {
      currentPassword?: string;
      passkeyPrfEnabled?: boolean;
      recoveryKey?: string;
    },
  ): Promise<IdentityResource> {
    return await this.commands.updateProfile(
      session,
      profile,
      newPassword,
      options ?? {},
    );
  }
}
