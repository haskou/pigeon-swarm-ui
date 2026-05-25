import type { ConversationKeyEntry } from '../../../../shared/domain/pigeonResources.types';

export type EncryptedCommunityKey = {
  algorithm: 'AES-GCM';
  ciphertext: string;
  nonce: string;
  version: 1;
};

export type CommunityInviteKeyEnvelope = {
  encryptedCommunityKey: EncryptedCommunityKey;
  secret: string;
};

const algorithm = 'AES-GCM';
const keyLengthBytes = 32;
const nonceLengthBytes = 12;

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(length));

  crypto.getRandomValues(bytes);

  return bytes;
}

async function importAesKey(
  secret: Uint8Array<ArrayBuffer>,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'raw',
    secret,
    { length: 256, name: algorithm },
    false,
    usages,
  );
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export async function encryptCommunityInviteKey(
  keyEntry: ConversationKeyEntry,
): Promise<CommunityInviteKeyEnvelope> {
  const secret = randomBytes(keyLengthBytes);
  const nonce = randomBytes(nonceLengthBytes);
  const key = await importAesKey(secret, ['encrypt']);
  const ciphertext = await crypto.subtle.encrypt(
    { iv: nonce, name: algorithm },
    key,
    new TextEncoder().encode(JSON.stringify(keyEntry)),
  );

  return {
    encryptedCommunityKey: {
      algorithm,
      ciphertext: encodeBase64Url(new Uint8Array(ciphertext)),
      nonce: encodeBase64Url(nonce),
      version: 1,
    },
    secret: encodeBase64Url(secret),
  };
}

export async function decryptCommunityInviteKey(
  encryptedCommunityKey: EncryptedCommunityKey,
  secret: string,
): Promise<ConversationKeyEntry> {
  if (
    encryptedCommunityKey.version !== 1 ||
    encryptedCommunityKey.algorithm !== algorithm
  ) {
    throw new Error('Unsupported community invite key envelope.');
  }

  const key = await importAesKey(decodeBase64Url(secret), ['decrypt']);
  const plaintext = await crypto.subtle.decrypt(
    { iv: decodeBase64Url(encryptedCommunityKey.nonce), name: algorithm },
    key,
    decodeBase64Url(encryptedCommunityKey.ciphertext),
  );
  const parsed = JSON.parse(
    new TextDecoder().decode(plaintext),
  ) as Partial<ConversationKeyEntry>;

  if (
    !parsed.conversationId ||
    !parsed.privateKey ||
    !parsed.publicKey ||
    typeof parsed.createdAt !== 'number'
  ) {
    throw new Error('Invalid community invite key.');
  }

  return {
    conversationId: parsed.conversationId,
    createdAt: parsed.createdAt,
    peerIdentityId: parsed.peerIdentityId ?? '',
    privateKey: parsed.privateKey,
    publicKey: parsed.publicKey,
  };
}
