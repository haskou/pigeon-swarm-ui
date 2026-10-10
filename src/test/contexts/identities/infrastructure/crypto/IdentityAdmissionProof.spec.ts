import { createHash } from 'node:crypto';

import { IdentityAdmissionProof } from '../../../../../contexts/identities/infrastructure/crypto/IdentityAdmissionProof';

function leadingZeroBits(digest: Buffer): number {
  let bits = 0;

  for (const byte of digest) {
    if (byte === 0) {
      bits += 8;
      continue;
    }

    return bits + Math.clz32(byte) - 24;
  }

  return bits;
}

describe(IdentityAdmissionProof.name, () => {
  it('mines a nonce the node accepts, whatever the order of the networks', async () => {
    const nonce = await IdentityAdmissionProof.mine('identity-1', ['b', 'a']);
    const digest = createHash('sha256')
      .update(`pigeon-identity-admission:v1:identity-1:a,b:${nonce}`)
      .digest();

    expect(leadingZeroBits(digest)).toBeGreaterThanOrEqual(
      IdentityAdmissionProof.DEFAULT_DIFFICULTY_BITS,
    );
  });

  it('does not cover another identity or another network set', async () => {
    const nonce = await IdentityAdmissionProof.mine('identity-1', ['a'], 12);

    expect(IdentityAdmissionProof.isValid('identity-1', ['a'], nonce, 12)).toBe(
      true,
    );
    expect(IdentityAdmissionProof.isValid('identity-2', ['a'], nonce, 12)).toBe(
      false,
    );
    expect(
      IdentityAdmissionProof.isValid('identity-1', ['a', 'b'], nonce, 12),
    ).toBe(false);
  });
});
