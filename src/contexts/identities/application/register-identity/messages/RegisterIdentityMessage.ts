import { Timestamp } from '@haskou/value-objects';

import { IdentityProfile } from '../../../domain/profile/IdentityProfile';
import { IdentityMasterKeyProtection } from '../../../domain/value-objects/IdentityMasterKeyProtection';
import { IdentityNetworkMemberships } from '../../../domain/value-objects/IdentityNetworkMemberships';

export class RegisterIdentityMessage {
  public constructor(
    private readonly input: {
      handle?: string;
      name: string;
      networks: string[];
      occurredAt: number;
      password: string;
      passkeyPrfEnabled?: boolean;
      recoveryKey?: string;
    },
  ) {}

  public getNetworkMemberships(): IdentityNetworkMemberships {
    return IdentityNetworkMemberships.fromPrimitives(this.input.networks);
  }

  public getOccurredAt(): Timestamp {
    return new Timestamp(this.input.occurredAt);
  }

  public getProfile(): IdentityProfile {
    return IdentityProfile.fromPrimitives({
      banner: undefined,
      biography: undefined,
      handle: this.input.handle?.trim() || undefined,
      name: this.input.name.trim(),
      picture: undefined,
    });
  }

  public getProtection(): IdentityMasterKeyProtection {
    return IdentityMasterKeyProtection.fromPrimitives({
      passkeyPrfEnabled: this.input.passkeyPrfEnabled ?? false,
      password: this.input.password,
      recoveryKey: this.input.recoveryKey,
    });
  }
}
