import { passwordRequirement } from '../../../../../contexts/identities/presentation/auth/PasswordRequirement';
import { copy } from '../../../../../shared/presentation/i18n/copy';

const completeChecks = {
  lowercase: true,
  match: true,
  maxLength: true,
  minLength: true,
  number: true,
  symbol: true,
  uppercase: true,
};

describe('passwordRequirement', () => {
  it('explains the minimum length before the remaining requirements', () => {
    const progress = passwordRequirement({
      ...completeChecks,
      minLength: false,
      number: false,
    });

    expect(progress.message).toBe(
      copy.auth.passwordRequirementNext.minLength.replace('{minimum}', '20'),
    );
  });

  it('reports the next unmet requirement after the length is valid', () => {
    const progress = passwordRequirement({
      ...completeChecks,
      lowercase: false,
    });

    expect(progress.message).toBe(copy.auth.passwordRequirementNext.lowercase);
  });

  it('reports a valid password when every requirement is met', () => {
    const progress = passwordRequirement(completeChecks);

    expect(progress).toEqual({
      complete: 7,
      message: copy.auth.passwordRequirementNext.valid,
      total: 7,
    });
  });
});
