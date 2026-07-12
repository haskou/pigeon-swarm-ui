import type { IdentityKeychainPort } from './ports/IdentityKeychainPort';
import type { IdentityPresencePort } from './ports/IdentityPresencePort';
import type { IdentityProfilePort } from './ports/IdentityProfilePort';
import type { IdentityProtectionPort } from './ports/IdentityProtectionPort';
import type { LoginIdentityPort } from './ports/LoginIdentityPort';
import type { RegisterIdentityPort } from './ports/RegisterIdentityPort';
import type { SessionApplicationPort } from './ports/SessionApplicationPort';

export type IdentityContextPorts = {
  keychain: IdentityKeychainPort;
  login: LoginIdentityPort;
  presence: IdentityPresencePort;
  profile: IdentityProfilePort;
  protection: IdentityProtectionPort;
  register: RegisterIdentityPort;
  session: SessionApplicationPort;
};
