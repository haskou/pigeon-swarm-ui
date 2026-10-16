import { CommitmentId } from '@haskou/pigeon-swarm-crypto';
import vectors from '@haskou/pigeon-swarm-crypto/vectors/commitment-ids.json';

// The vectors ship with @haskou/pigeon-swarm-crypto; the node runs the same.
describe('call commitment id vectors', () => {
  it.each(vectors.call.valid)(
    'derives the call id of $name',
    ({ args, id }) => {
      const [creator, nonce] = args as [string, string];

      expect(CommitmentId.call(creator, nonce)).toBe(id);
    },
  );

  it.each(vectors.call.invalid)('refuses the call id of $name', ({ args }) => {
    const [creator, nonce] = args as [string, string];

    expect(() => CommitmentId.call(creator, nonce)).toThrow();
  });
});
