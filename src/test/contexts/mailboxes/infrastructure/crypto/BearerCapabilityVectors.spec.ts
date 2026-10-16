import { BearerCapability } from '@haskou/pigeon-swarm-crypto';
import vectors from '@haskou/pigeon-swarm-crypto/vectors/bearer-capabilities.json';

// The vectors ship with @haskou/pigeon-swarm-crypto; the node stores these
// hashes for mailbox post and read tokens.
describe('bearer capability vectors', () => {
  it.each(vectors.hash.valid)('hashes $name', ({ hash, token }) => {
    expect(BearerCapability.hash(token)).toBe(hash);
  });

  it.each(vectors.hash.invalid)('refuses $name', ({ token }) => {
    expect(() => BearerCapability.hash(token)).toThrow();
  });

  it('generates a token whose hash it returns', () => {
    const { hash, token } = BearerCapability.generate();

    expect(BearerCapability.hash(token)).toBe(hash);
  });
});
