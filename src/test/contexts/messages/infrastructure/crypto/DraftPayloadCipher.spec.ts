import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { DraftPayloadCipher } from '../../../../../contexts/messages/infrastructure/crypto/DraftPayloadCipher';

describe(DraftPayloadCipher.name, () => {
  const masterKey = SymmetricKey.generate();
  const sessionUnder = (root?: SymmetricKey): Session =>
    ({
      deviceSealedRootKey: root,
      identity: { id: 'identity-1' },
      masterKey,
    }) as unknown as Session;

  it('round-trips a draft under the device sealed root', () => {
    const cipher = new DraftPayloadCipher();
    const session = sessionUnder(SymmetricKey.generate());

    expect(cipher.decrypt(session, cipher.encrypt(session, 'draft text'))).toBe(
      'draft text',
    );
  });

  it('seals drafts under the device sealed root, never the identity root', () => {
    const cipher = new DraftPayloadCipher();
    const root = SymmetricKey.generate();
    const sealed = cipher.encrypt(sessionUnder(root), 'draft text');

    expect(cipher.decrypt(sessionUnder(root), sealed)).toBe('draft text');
    expect(
      cipher.decrypt(sessionUnder(SymmetricKey.generate()), sealed),
    ).toBeNull();
  });

  it('reads a draft sealed under the identity root as unopenable', () => {
    const cipher = new DraftPayloadCipher();
    const sealed = masterKey
      .encrypt(JSON.stringify({ content: 'draft text' }))
      .toString();

    expect(
      cipher.decrypt(sessionUnder(SymmetricKey.generate()), sealed),
    ).toBeNull();
  });

  it('reads a payload that is not a draft envelope as unopenable', () => {
    const cipher = new DraftPayloadCipher();
    const root = SymmetricKey.generate();

    expect(
      cipher.decrypt(
        sessionUnder(root),
        root.encrypt('plain draft').toString(),
      ),
    ).toBeNull();
    expect(
      cipher.decrypt(
        sessionUnder(root),
        root.encrypt(JSON.stringify({ content: 7 })).toString(),
      ),
    ).toBeNull();
  });

  it('refuses to seal or open a draft without a device sealed root', () => {
    const cipher = new DraftPayloadCipher();
    const sealed = cipher.encrypt(
      sessionUnder(SymmetricKey.generate()),
      'draft text',
    );

    expect(() => cipher.encrypt(sessionUnder(), 'draft text')).toThrow();
    expect(() => cipher.decrypt(sessionUnder(), sealed)).toThrow();
  });
});
