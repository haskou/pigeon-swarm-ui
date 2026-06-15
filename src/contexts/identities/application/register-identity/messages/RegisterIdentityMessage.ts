import { ProfileHandle } from '../../../domain/profile/ProfileHandle';
import { ProfileName } from '../../../domain/profile/ProfileName';
import { IdentityNetworkMemberships } from '../../../domain/value-objects/IdentityNetworkMemberships';

export class RegisterIdentityMessage {
  private readonly handle?: ProfileHandle;
  private readonly name: ProfileName;
  private readonly networks: IdentityNetworkMemberships;
  private readonly password: string;
  private readonly passkeyPrfEnabled: boolean;
  private readonly recoveryKey?: string;

  public constructor(input: {
    handle?: string;
    name: string;
    networks: string[];
    password: string;
    passkeyPrfEnabled?: boolean;
    recoveryKey?: string;
  }) {
    this.handle = input.handle
      ? ProfileHandle.fromString(input.handle)
      : undefined;
    this.name = ProfileName.fromString(input.name);
    this.networks = IdentityNetworkMemberships.fromPrimitives(input.networks);
    this.password = input.password;
    this.passkeyPrfEnabled = input.passkeyPrfEnabled ?? false;
    this.recoveryKey = input.recoveryKey;
  }

  public getHandle(): ProfileHandle | undefined {
    return this.handle;
  }

  public getName(): ProfileName {
    return this.name;
  }

  public getNetworks(): IdentityNetworkMemberships {
    return this.networks;
  }

  public getPassword(): string {
    return this.password;
  }

  public isPasskeyPrfEnabled(): boolean {
    return this.passkeyPrfEnabled;
  }

  public getRecoveryKey(): string | undefined {
    return this.recoveryKey;
  }
}
