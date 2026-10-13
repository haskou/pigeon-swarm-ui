import { createHash } from 'node:crypto';

import { IdentityAdmissionProof } from '../../../../../contexts/identities/infrastructure/crypto/IdentityAdmissionProof';
import vectors from '../../../../fixtures/identity-admission-proof-vectors.json';

// Same bytes as pigeon-swarm-node
// tests/fixtures/identity-admission-proof-vectors.json.
describe('IdentityAdmissionProof vectors', () => {
  const all = [...vectors.accepted, ...vectors.rejected];

  it('pins the protocol difficulty', () => {
    expect(IdentityAdmissionProof.DEFAULT_DIFFICULTY_BITS).toBe(
      vectors.difficultyBits,
    );
  });

  it.each(all)(
    'pins the preimage and digest of $name',
    ({ derived, input }) => {
      const preimage = IdentityAdmissionProof.preimage(
        input.identityId,
        input.networkIds,
        input.nonce,
      );

      expect(preimage).toBe(derived.preimage);
      expect(createHash('sha256').update(preimage).digest('hex')).toBe(
        derived.digestHex,
      );
    },
  );

  it.each(vectors.accepted)('accepts and mines $name', async ({ input }) => {
    expect(
      IdentityAdmissionProof.isValid(
        input.identityId,
        input.networkIds,
        input.nonce,
      ),
    ).toBe(true);
    await expect(
      IdentityAdmissionProof.mine(input.identityId, input.networkIds),
    ).resolves.toBe(input.nonce);
  });

  it.each(vectors.rejected)('rejects $name', ({ input }) => {
    expect(
      IdentityAdmissionProof.isValid(
        input.identityId,
        input.networkIds,
        input.nonce,
      ),
    ).toBe(false);
  });
});
