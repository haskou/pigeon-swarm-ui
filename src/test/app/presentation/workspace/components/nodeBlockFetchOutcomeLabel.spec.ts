import { nodeBlockFetchOutcomeLabel } from '../../../../../app/presentation/workspace/components/nodeBlockFetchOutcomeLabel';
import { copy } from '../../../../../shared/presentation/i18n/copy';

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
    const outcomeCopy: Record<string, string> = copy.nodeAccess.fetchOutcomes;

    expect(nodeBlockFetchOutcomeLabel('non-canonical-identity-id')).toBe(
      outcomeCopy['non-canonical-identity-id'],
    );
    expect(outcomeCopy['non-canonical-identity-id']).toEqual(
      expect.any(String),
    );
  });

  it('has no label before the first fetch or for an unknown outcome', () => {
    expect(nodeBlockFetchOutcomeLabel(null)).toBeNull();
    expect(nodeBlockFetchOutcomeLabel('toString')).toBeNull();
  });
});
