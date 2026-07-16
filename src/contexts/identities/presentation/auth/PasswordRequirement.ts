import { copy } from '../../../../shared/presentation/i18n/copy';
import { PASSWORD_MIN_LENGTH } from './credentialsValidation';

export type PasswordRequirementChecks = {
  lowercase: boolean;
  match: boolean;
  maxLength: boolean;
  minLength: boolean;
  number: boolean;
  symbol: boolean;
  uppercase: boolean;
};

export type PasswordRequirement = {
  complete: number;
  message: string;
  total: number;
};

export function passwordRequirement(
  checks: PasswordRequirementChecks,
): PasswordRequirement {
  const values = Object.values(checks);

  return {
    complete: values.filter(Boolean).length,
    message: nextPasswordRequirementMessage(checks),
    total: values.length,
  };
}

function nextPasswordRequirementMessage(
  checks: PasswordRequirementChecks,
): string {
  if (!checks.minLength) {
    return copy.auth.passwordRequirementNext.minLength.replace(
      '{minimum}',
      String(PASSWORD_MIN_LENGTH),
    );
  }

  if (!checks.maxLength) return copy.auth.passwordRequirementNext.maxLength;
  if (!checks.uppercase) return copy.auth.passwordRequirementNext.uppercase;
  if (!checks.lowercase) return copy.auth.passwordRequirementNext.lowercase;
  if (!checks.number) return copy.auth.passwordRequirementNext.number;
  if (!checks.symbol) return copy.auth.passwordRequirementNext.symbol;
  if (!checks.match) return copy.auth.passwordRequirementNext.match;

  return copy.auth.passwordRequirementNext.valid;
}
