import type { PasskeyPrfMasterKeyProtection } from '../../domain/PasskeyPrfMasterKeyProtection';

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
