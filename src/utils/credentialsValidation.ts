import { ProfileHandle } from '../domain/identities/profile/ProfileHandle';

export function normalizeHandleInput(value: string): string {
  return value.trim().replace(/^@+/, '').toLowerCase();
}

export function isValidHandle(value: string): boolean {
  try {
    new ProfileHandle(normalizeHandleInput(value));

    return true;
  } catch {
    return false;
  }
}

export function passwordValidationError(value: string): string | null {
  const checks = passwordValidationChecks(value);

  if (!checks.minLength) return 'too-short';

  if (!checks.maxLength) return 'too-long';

  if (!checks.uppercase) return 'missing-uppercase';

  if (!checks.lowercase) return 'missing-lowercase';

  if (!checks.number) return 'missing-number';

  if (!checks.symbol) return 'missing-symbol';

  return null;
}

export function isValidPassword(value: string): boolean {
  return passwordValidationError(value) === null;
}

export function passwordValidationChecks(value: string): {
  lowercase: boolean;
  maxLength: boolean;
  minLength: boolean;
  number: boolean;
  symbol: boolean;
  uppercase: boolean;
} {
  return {
    lowercase: /[a-z]/.test(value),
    maxLength: value.length <= 256,
    minLength: value.length >= 12,
    number: /[0-9]/.test(value),
    symbol: /[^A-Za-z0-9]/.test(value),
    uppercase: /[A-Z]/.test(value),
  };
}
