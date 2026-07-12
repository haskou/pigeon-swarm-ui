import type { ConversationKeyEntry } from '../../../../../shared/domain/pigeonResources.types';

import {
  decryptCommunityInviteKey,
  encryptCommunityInviteKey,
} from '../../../../../contexts/communities/infrastructure/crypto/communityInviteKeyEnvelope';

describe('community invite key envelope', () => {
  const keyEntry: ConversationKeyEntry = {
    algorithm: 'aes-256-gcm',
    conversationId: 'community-1',
    createdAt: 1770000000000,
    key: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    kind: 'community',
    peerIdentityId: '',
    version: 2,
  };

  it('encrypts the community key entry behind a short fragment secret', async () => {
    const envelope = await encryptCommunityInviteKey(keyEntry);

    expect(envelope.secret).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(envelope.secret).toHaveLength(43);
    expect(envelope.encryptedCommunityKey).toMatchObject({
      algorithm: 'AES-GCM',
      version: 1,
    });
    expect(envelope.encryptedCommunityKey.ciphertext).not.toContain(
      keyEntry.key,
    );
  });

  it('decrypts the encrypted community key entry with the fragment secret', async () => {
    const envelope = await encryptCommunityInviteKey(keyEntry);

    await expect(
      decryptCommunityInviteKey(
        envelope.encryptedCommunityKey,
        envelope.secret,
      ),
    ).resolves.toEqual(keyEntry);
  });

  it('rejects a different fragment secret', async () => {
    const envelope = await encryptCommunityInviteKey(keyEntry);
    const otherEnvelope = await encryptCommunityInviteKey(keyEntry);

    await expect(
      decryptCommunityInviteKey(
        envelope.encryptedCommunityKey,
        otherEnvelope.secret,
      ),
    ).rejects.toThrow();
  });
});
