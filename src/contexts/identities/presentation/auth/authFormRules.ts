import {
  isValidHandle,
  isValidPassword,
  normalizeHandleInput,
} from './credentialsValidation';

export type AuthMode = 'login' | 'create';

export function normalizeIdentityLogin(value: string): string {
  const trimmed = value.trim();

  return trimmed.startsWith('@') ? normalizeHandleInput(trimmed) : trimmed;
}

export function canSubmitAuthForm(input: {
  availableNetworkCount: number;
  handle: string;
  identityId: string;
  mode: AuthMode;
  name: string;
  networks: string;
  password: string;
  passwordConfirmation: string;
  selectedNetwork: string;
}): boolean {
  if (input.mode === 'login') {
    return input.identityId.trim().length > 0 && input.password.length > 0;
  }

  return canSubmitCreateIdentity(input);
}

export function registrationNetworks(input: {
  availableNetworkCount: number;
  fallbackNetworks: string;
  selectedNetwork: string;
}): string[] {
  if (input.selectedNetwork) return [input.selectedNetwork];

  if (input.availableNetworkCount > 0) return [];

  return input.fallbackNetworks
    .split(',')
    .map((network) => network.trim())
    .filter(Boolean);
}

function canSubmitCreateIdentity(input: {
  availableNetworkCount: number;
  handle: string;
  name: string;
  networks: string;
  password: string;
  passwordConfirmation: string;
  selectedNetwork: string;
}): boolean {
  return (
    input.name.trim().length > 0 &&
    (!input.handle.trim() || isValidHandle(input.handle)) &&
    isValidPassword(input.password) &&
    input.password === input.passwordConfirmation &&
    // The node rejects an identity with no network, so a create must resolve one.
    registrationNetworks({
      availableNetworkCount: input.availableNetworkCount,
      fallbackNetworks: input.networks,
      selectedNetwork: input.selectedNetwork,
    }).length > 0
  );
}

/**
 * Whether the login screen still waits for the lookup of the identifier it
 * shows. Until it resolves, the identity input may still be replaced by the
 * preview of that identity.
 */
export function identityLookupPending(input: {
  identityId: string;
  mode: AuthMode;
  previewLoaded: boolean;
  requestedLookup: string;
}): boolean {
  const lookup = normalizeIdentityLogin(input.identityId);

  if (input.mode !== 'login' || !lookup) return false;

  return input.requestedLookup !== lookup || !input.previewLoaded;
}
