import type { KeyPair, SymmetricKey } from '@haskou/value-objects';

import type { IdentityResource } from '../../../../shared/domain/pigeonResources.types';

export type CreatedIdentityMaterial = {
  identity: IdentityResource;
  keyPair: KeyPair;
  masterKey: SymmetricKey;
};
