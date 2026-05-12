export function normalizeHandleInput(value: string): string {
  return value.trim().replace(/^@+/, '').toLowerCase();
}

export function isValidHandle(value: string): boolean {
  const handle = normalizeHandleInput(value);

  return /^[a-z0-9._-]{3,32}$/.test(handle);
}

export function passwordValidationError(value: string): string | null {
  if (value.length < 12) return 'too-short';
  if (value.length > 256) return 'too-long';
  if (!/[A-Z]/.test(value)) return 'missing-uppercase';
  if (!/[a-z]/.test(value)) return 'missing-lowercase';
  if (!/[0-9]/.test(value)) return 'missing-number';
  if (!/[^A-Za-z0-9]/.test(value)) return 'missing-symbol';

  return null;
}

export function isValidPassword(value: string): boolean {
  return passwordValidationError(value) === null;
}
