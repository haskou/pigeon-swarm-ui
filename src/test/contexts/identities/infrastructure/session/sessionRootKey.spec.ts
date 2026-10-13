import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { sessionRootKey } from '../../../../../contexts/identities/infrastructure/session/sessionRootKey';

describe('sessionRootKey', () => {
  const masterKey = SymmetricKey.generate();

  it('returns the device sealed root', () => {
    const root = SymmetricKey.generate();

    expect(
      sessionRootKey({
        deviceSealedRootKey: root,
        masterKey,
      } as unknown as Session),
    ).toBe(root);
  });

  it('refuses a session without a device sealed root instead of using the identity root', () => {
    expect(() => sessionRootKey({ masterKey } as unknown as Session)).toThrow(
      'Device sealed root is not open.',
    );
  });
});
