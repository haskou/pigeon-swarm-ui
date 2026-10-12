import { canSubmitAuthForm } from '../../../../../contexts/identities/presentation/auth/authFormRules';

const PASSWORD = 'Disposable-mailbox-test-password1!abc123';

// Typed as a variable so each case can omit or add fields without a literal
// excess-property check; the rule itself is what these tests exercise.
function createInput(overrides: {
  availableNetworkCount: number;
  networks?: string;
  selectedNetwork?: string;
}) {
  return {
    handle: '',
    identityId: '',
    mode: 'create' as const,
    name: 'Mailbox A',
    networks: '',
    password: PASSWORD,
    passwordConfirmation: PASSWORD,
    selectedNetwork: '',
    ...overrides,
  };
}

describe('canSubmitAuthForm', () => {
  it('does not allow creating an identity without any network', () => {
    const input = createInput({ availableNetworkCount: 0 });

    expect(canSubmitAuthForm(input)).toBe(false);
  });

  it('does not allow creating an identity while listed networks are unselected', () => {
    const input = createInput({ availableNetworkCount: 2 });

    expect(canSubmitAuthForm(input)).toBe(false);
  });

  it('allows creating an identity once a listed network is selected', () => {
    const input = createInput({
      availableNetworkCount: 2,
      selectedNetwork: 'network-a',
    });

    expect(canSubmitAuthForm(input)).toBe(true);
  });

  it('allows creating an identity from typed fallback networks', () => {
    const input = createInput({
      availableNetworkCount: 0,
      networks: 'network-a, network-b',
    });

    expect(canSubmitAuthForm(input)).toBe(true);
  });

  it('does not allow creating an identity from separators alone', () => {
    const input = createInput({ availableNetworkCount: 0, networks: ' , ' });

    expect(canSubmitAuthForm(input)).toBe(false);
  });

  it('keeps login independent of network selection', () => {
    const input = {
      availableNetworkCount: 0,
      handle: '',
      identityId: 'mailbox-a',
      mode: 'login' as const,
      name: '',
      networks: '',
      password: PASSWORD,
      passwordConfirmation: '',
      selectedNetwork: '',
    };

    expect(canSubmitAuthForm(input)).toBe(true);
  });
});
