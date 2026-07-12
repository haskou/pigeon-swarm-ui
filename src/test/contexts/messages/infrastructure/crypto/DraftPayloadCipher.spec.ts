import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { DraftPayloadCipher } from '../../../../../contexts/messages/infrastructure/crypto/DraftPayloadCipher';

describe(DraftPayloadCipher.name, () => {
  it('decrypts draft payload content from its local envelope', () => {
    const decrypt = jest.fn().mockReturnValue({
      toString: () => JSON.stringify({ content: 'draft text' }),
    });
    const session = {
      masterKey: { decrypt },
      password: 'secret',
    } as unknown as Session;
    const cipher = new DraftPayloadCipher();

    expect(cipher.decrypt(session, 'encrypted-draft')).toBe('draft text');
    expect(decrypt).toHaveBeenCalledWith(expect.anything());
  });

  it('keeps plaintext draft payloads readable during local recovery', () => {
    const session = {
      masterKey: {
        decrypt: jest.fn().mockReturnValue({
          toString: () => 'plain draft',
        }),
      },
      password: 'secret',
    } as unknown as Session;
    const cipher = new DraftPayloadCipher();

    expect(cipher.decrypt(session, 'encrypted-draft')).toBe('plain draft');
  });
});
