import { EncryptedPayload, PrivateKey, PublicKey } from '@haskou/value-objects';
import { CryptoAdapter } from '@haskou/value-objects/dist/value-objects/crypto/CryptoAdapter';

import type {
  ConversationKeyEntry,
  IdentityResource,
  MessageAttachment,
  Session,
} from '../types';

import { normalizeIdentityId } from '../../utils/identityId';

export type CommunityChannelPlainPayload = {
  attachments?: MessageAttachment[];
  authorIdentityId?: string;
  channelId?: string;
  communityId?: string;
  content?: string;
  timestamp?: number;
  type?: string;
};

type CommunityChannelEnvelope = {
  algorithm: 'community-channel.v1';
  ciphertext: string;
  iv: string;
  recipients: Record<string, string>;
};

type EncryptCommunityChannelPayloadInput = {
  attachments: MessageAttachment[];
  authorIdentityId: string;
  channelId: string;
  communityKey?: ConversationKeyEntry;
  communityId: string;
  content: string;
  recipients: IdentityResource[];
  timestamp: number;
};

const gcmTagBytes = 16;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function concatBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
  const output = new Uint8Array(left.byteLength + right.byteLength);

  output.set(left);
  output.set(right, left.byteLength);

  return output;
}

function decryptCommunityEnvelope(
  envelope: CommunityChannelEnvelope,
  rawKeyBase64: string,
): CommunityChannelPlainPayload {
  const ciphertext = base64ToBytes(envelope.ciphertext);
  const decrypted = CryptoAdapter.decryptAes256Gcm(
    base64ToBytes(rawKeyBase64),
    base64ToBytes(envelope.iv),
    ciphertext.subarray(0, -gcmTagBytes),
    ciphertext.subarray(-gcmTagBytes),
  );

  return JSON.parse(
    new TextDecoder().decode(decrypted),
  ) as CommunityChannelPlainPayload;
}

export function encryptCommunityChannelPayload(
  input: EncryptCommunityChannelPayloadInput,
): string {
  const key = CryptoAdapter.randomBytes(32);
  const rawKeyBase64 = bytesToBase64(key);
  const iv = CryptoAdapter.randomBytes(12);
  const plaintext = new TextEncoder().encode(
    JSON.stringify({
      attachments: input.attachments,
      authorIdentityId: input.authorIdentityId,
      channelId: input.channelId,
      communityId: input.communityId,
      content: input.content,
      timestamp: input.timestamp,
      type: 'CommunityChannelMessageSent',
    }),
  );
  const encrypted = CryptoAdapter.encryptAes256Gcm(key, iv, plaintext);
  const ciphertext = concatBytes(encrypted.cipherText, encrypted.tag);
  const recipients: Record<string, string> = {};

  if (input.communityKey) {
    recipients[input.communityId] = PublicKey.fromPEM(
      input.communityKey.publicKey,
    )
      .encrypt(rawKeyBase64)
      .toString();
  }

  for (const identity of input.recipients) {
    recipients[identity.id] = PublicKey.fromPEM(
      identity.encryptedKeyPair.publicKey,
    )
      .encrypt(rawKeyBase64)
      .toString();
  }

  return JSON.stringify({
    algorithm: 'community-channel.v1',
    ciphertext: bytesToBase64(ciphertext),
    iv: bytesToBase64(iv),
    recipients,
  } satisfies CommunityChannelEnvelope);
}

export async function decryptCommunityChannelPayload(
  session: Session,
  encryptedPayload: string,
  missingKeyMessage: string,
): Promise<CommunityChannelPlainPayload> {
  const envelope = JSON.parse(encryptedPayload) as CommunityChannelEnvelope;
  const wrappedKey =
    envelope.recipients[session.identity.id] ??
    envelope.recipients[normalizeIdentityId(session.identity.id)];

  if (!wrappedKey) {
    const communityRecipient = Object.values(session.keychain.conversations)
      .map((keyEntry) => ({
        keyEntry,
        wrappedKey: envelope.recipients[keyEntry.conversationId],
      }))
      .find((entry) => entry.wrappedKey);

    if (!communityRecipient?.wrappedKey) {
      throw new Error(missingKeyMessage);
    }

    const rawCommunityKey = await PrivateKey.fromPEM(
      communityRecipient.keyEntry.privateKey,
    ).decrypt(new EncryptedPayload(communityRecipient.wrappedKey));

    return decryptCommunityEnvelope(
      envelope,
      new TextDecoder().decode(rawCommunityKey),
    );
  }

  const rawKey = await session.encryptedKeyPair.decrypt(
    new EncryptedPayload(wrappedKey),
    session.password,
  );

  return decryptCommunityEnvelope(envelope, rawKey.toString());
}
