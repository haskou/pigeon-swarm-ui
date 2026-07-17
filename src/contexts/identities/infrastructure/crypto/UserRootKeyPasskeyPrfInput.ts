import type { PasskeyPrfMasterKeyProtection } from './PasskeyPrfMasterKeyProtection';

export type UserRootKeyPasskeyPrfInput =
  | {
      displayName: string;
      identityId: string;
      mode: 'create';
    }
  | {
      mode: 'preserve';
      protection: PasskeyPrfMasterKeyProtection;
    };
