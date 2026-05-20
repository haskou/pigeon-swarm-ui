export function normalizeIdentityId(value: string): string {
  const trimmed = value.trim();

  if (!trimmed.includes('-----BEGIN PUBLIC KEY-----')) return trimmed;

  return trimmed
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s+/g, '');
}
