import { sha256 } from '@noble/hashes/sha2.js';

/**
 * Hashcash proof the node requires to mint an identity into a set of networks.
 * SHA-256 over `pigeon-identity-admission:v1:<id>:<sorted networks>:<nonce>`
 * must start with `difficultyBits` zero bits. Mirrors the node's
 * `IdentityAdmissionProof`; both sides must agree on the difficulty.
 */
export class IdentityAdmissionProof {
  private static readonly DOMAIN = 'pigeon-identity-admission:v1';
  private static readonly YIELD_EVERY = 4096;
  public static readonly DEFAULT_DIFFICULTY_BITS = 16;

  private static hasLeadingZeroBits(digest: Uint8Array, bits: number): boolean {
    const wholeBytes = Math.floor(bits / 8);

    for (let index = 0; index < wholeBytes; index += 1) {
      if (digest[index] !== 0) {
        return false;
      }
    }

    const remainder = bits % 8;

    return (
      remainder === 0 ||
      Math.floor(digest[wholeBytes] / 2 ** (8 - remainder)) === 0
    );
  }

  public static isValid(
    identityId: string,
    networkIds: string[],
    nonce: string,
    difficultyBits = IdentityAdmissionProof.DEFAULT_DIFFICULTY_BITS,
  ): boolean {
    return IdentityAdmissionProof.hasLeadingZeroBits(
      sha256(
        new TextEncoder().encode(
          IdentityAdmissionProof.preimage(identityId, networkIds, nonce),
        ),
      ),
      difficultyBits,
    );
  }

  /** Yields to the event loop periodically so the UI stays responsive. */
  public static async mine(
    identityId: string,
    networkIds: string[],
    difficultyBits = IdentityAdmissionProof.DEFAULT_DIFFICULTY_BITS,
  ): Promise<string> {
    for (let nonce = 0; ; nonce += 1) {
      const candidate = nonce.toString();

      if (
        IdentityAdmissionProof.isValid(
          identityId,
          networkIds,
          candidate,
          difficultyBits,
        )
      ) {
        return candidate;
      }

      if (nonce % IdentityAdmissionProof.YIELD_EVERY === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  public static preimage(
    identityId: string,
    networkIds: string[],
    nonce: string,
  ): string {
    return [
      IdentityAdmissionProof.DOMAIN,
      identityId,
      [...networkIds].sort().join(','),
      nonce,
    ].join(':');
  }
}
