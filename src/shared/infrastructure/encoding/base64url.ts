import { Buffer } from 'buffer';

/**
 * Unpadded base64url. The browser `buffer` polyfill (6.x) has no base64url
 * encoding and throws, so browser code uses these helpers instead.
 */
export function encodeBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function decodeBase64Url(text: string): Buffer {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');

  return Buffer.from(
    base64.padEnd(Math.ceil(base64.length / 4) * 4, '='),
    'base64',
  );
}
