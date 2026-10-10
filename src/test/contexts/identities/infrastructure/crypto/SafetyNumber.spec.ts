import { SafetyNumber } from '../../../../../contexts/identities/infrastructure/crypto/SafetyNumber';

describe('SafetyNumber', () => {
  it('renders twelve groups of five decimal digits', async () => {
    const groups = await SafetyNumber.between('identity-a', 'identity-b');

    expect(groups).toHaveLength(12);
    for (const group of groups) {
      expect(group).toMatch(/^\d{5}$/);
    }
  });

  it('is the same for both members of the conversation', async () => {
    expect(await SafetyNumber.between('identity-a', 'identity-b')).toEqual(
      await SafetyNumber.between('identity-b', 'identity-a'),
    );
  });

  it('is stable across calls', async () => {
    expect(await SafetyNumber.between('identity-a', 'identity-b')).toEqual(
      await SafetyNumber.between('identity-a', 'identity-b'),
    );
  });

  it('changes when either identity changes', async () => {
    const original = await SafetyNumber.between('identity-a', 'identity-b');

    expect(await SafetyNumber.between('identity-a', 'identity-c')).not.toEqual(
      original,
    );
    expect(await SafetyNumber.between('identity-c', 'identity-b')).not.toEqual(
      original,
    );
  });

  it('does not collide when the identity ids are split differently', async () => {
    expect(await SafetyNumber.between('ab', 'cd')).not.toEqual(
      await SafetyNumber.between('a', 'bcd'),
    );
  });
});
