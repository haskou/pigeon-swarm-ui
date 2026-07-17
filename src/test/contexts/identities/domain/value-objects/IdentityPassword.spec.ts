import { IdentityPasswordLowercaseRequiredError } from '../../../../../contexts/identities/domain/errors/IdentityPasswordLowercaseRequiredError';
import { IdentityPasswordNumberRequiredError } from '../../../../../contexts/identities/domain/errors/IdentityPasswordNumberRequiredError';
import { IdentityPasswordRequiredError } from '../../../../../contexts/identities/domain/errors/IdentityPasswordRequiredError';
import { IdentityPasswordSymbolRequiredError } from '../../../../../contexts/identities/domain/errors/IdentityPasswordSymbolRequiredError';
import { IdentityPasswordTooShortError } from '../../../../../contexts/identities/domain/errors/IdentityPasswordTooShortError';
import { IdentityPasswordUppercaseRequiredError } from '../../../../../contexts/identities/domain/errors/IdentityPasswordUppercaseRequiredError';
import { IdentityPassword } from '../../../../../contexts/identities/domain/value-objects/IdentityPassword';

describe(IdentityPassword.name, () => {
  it('accepts a strong identity password', () => {
    expect(() =>
      IdentityPassword.fromString('Correct-Horse-Battery-9!').assertStrong(),
    ).not.toThrow();
  });

  it.each([
    ['', IdentityPasswordRequiredError],
    ['Short-Password-9!', IdentityPasswordTooShortError],
    ['lowercase password 99!', IdentityPasswordUppercaseRequiredError],
    ['UPPERCASE PASSWORD 99!', IdentityPasswordLowercaseRequiredError],
    ['Password without number!', IdentityPasswordNumberRequiredError],
    ['Passwordwithoutsymbol99', IdentityPasswordSymbolRequiredError],
  ])('rejects an invalid password', (password, ExpectedError) => {
    expect(() => {
      const identityPassword = IdentityPassword.fromString(password);

      identityPassword.assertStrong();
    }).toThrow(ExpectedError);
  });
});
