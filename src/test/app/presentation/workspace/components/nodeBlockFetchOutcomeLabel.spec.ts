import { nodeBlockFetchOutcomeLabel } from '../../../../../app/presentation/workspace/components/nodeBlockFetchOutcomeLabel';

describe(nodeBlockFetchOutcomeLabel.name, () => {
  // Every `lastFetchOutcome` the node documents (docs/api.md, block sources).
  it.each([
    'accepted',
    'not-newer',
    'invalid-signature',
    'invalid-document',
    'wrong-signer',
    'non-canonical-identity-id',
    'too-large',
    'redirected',
    'refused-address',
    'unreachable',
  ])('labels the %s outcome', (outcome) => {
    expect(nodeBlockFetchOutcomeLabel(outcome)).toEqual(expect.any(String));
  });

  it('tells the owner what to do when the list names an invalid identity id', () => {
    expect(nodeBlockFetchOutcomeLabel('non-canonical-identity-id')).toMatch(
      /owner/i,
    );
  });

  it('has no label before the first fetch or for an unknown outcome', () => {
    expect(nodeBlockFetchOutcomeLabel(null)).toBeNull();
    expect(nodeBlockFetchOutcomeLabel('toString')).toBeNull();
  });
});
