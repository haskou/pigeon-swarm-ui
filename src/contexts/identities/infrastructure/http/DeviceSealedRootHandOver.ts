import type { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { DeviceSealedSecretHandOverResource } from './resources/DeviceSealedSecretResource';

/** A fresh root sealed for the devices that remain after this one retires. */
export type DeviceSealedRootHandOver = {
  previous: SymmetricKey;
  root: SymmetricKey;
  sealedSecrets: DeviceSealedSecretHandOverResource;
};
