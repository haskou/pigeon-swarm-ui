import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { DraftPayloadCipher } from './DraftPayloadCipher';

describe(DraftPayloadCipher.name, () => {
  it('decrypts draft payload content from its local envelope', async () => {
    const decrypt = jest.fn().mockResolvedValue({
      toString: () => JSON.stringify({ content: 'draft text' }),
    });
    const session = {
      encryptedKeyPair: { decrypt },
      password: 'secret',
    } as unknown as Session;
    const cipher = new DraftPayloadCipher();

    await expect(cipher.decrypt(session, 'encrypted-draft')).resolves.toBe(
      'draft text',
    );
    expect(decrypt).toHaveBeenCalledWith(expect.anything(), 'secret');
  });

  it('keeps plaintext draft payloads readable during local recovery', async () => {
    const session = {
      encryptedKeyPair: {
        decrypt: jest.fn().mockResolvedValue({
          toString: () => 'plain draft',
        }),
      },
      password: 'secret',
    } as unknown as Session;
    const cipher = new DraftPayloadCipher();

    await expect(cipher.decrypt(session, 'encrypted-draft')).resolves.toBe(
      'plain draft',
    );
  });
});
