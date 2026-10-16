import { KeyFingerprint, PublicKey } from '@haskou/pigeon-swarm-crypto';
import { describe, expect, it } from '@jest/globals';
import { Buffer } from 'buffer';

import type { CommunityResource as Community } from '../../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { ConversationResource } from '../../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { DirectMessageOutboxItem } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageOutboxItem';

import { SecurityAuditReport } from '../../../../../app/presentation/workspace/components/SecurityAuditReport';

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const pem = (body: string): string =>
  `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----\n`;
const spki = (fill: number): string =>
  Buffer.concat([ED25519_SPKI_PREFIX, Buffer.alloc(32, fill)]).toString(
    'base64',
  );
const fingerprintOf = (body: string): string =>
  KeyFingerprint.ofPublicKey(PublicKey.fromPEM(pem(body)));
const OWN_ID = spki(11);
const PEER_ID = spki(12);
const IMPOSTOR_ID = spki(13);
const OWN_DEVICE = spki(14);
const OTHER_DEVICE = spki(15);
const PEER_DEVICE = spki(16);
const CONVERSATION_KEY = Buffer.alloc(32, 3).toString('base64');
const COMMUNITY_KEY = Buffer.alloc(32, 4).toString('base64');
const ROOT_KEY = Buffer.alloc(32, 5);
const MASTER_KEY = Buffer.alloc(32, 6);
const SIGNATURE_KEY = new Uint8Array([1, 2, 3, 4]);
const PEER_SIGNATURE_KEY = new Uint8Array([5, 6, 7, 8]);
const SIBLING_SIGNATURE_KEY = new Uint8Array([9, 10, 11, 12]);

const session = {
  authorizationEpoch: { valueOf: () => 'epoch-1' },
  authorizationRevision: { valueOf: () => 7 },
  deviceCredentialKeyPair: {
    toPrimitives: () => ({
      privateKey: 'device-private',
      publicKey: pem(OWN_DEVICE),
    }),
  },
  deviceId: { valueOf: () => '11111111-1111-4111-8111-111111111111' },
  deviceSealedRootKey: { getBuffer: () => ROOT_KEY },
  identity: { id: OWN_ID, profile: { name: 'Me' } },
  keychain: {
    conversations: {
      'community-entry': {
        algorithm: 'aes-256-gcm',
        conversationId: 'community-1',
        createdAt: 1,
        key: COMMUNITY_KEY,
        kind: 'community',
        peerIdentityId: '',
        version: 2,
      },
      'direct-entry': {
        algorithm: 'aes-256-gcm',
        conversationId: 'one-to-one:1',
        createdAt: 1,
        key: CONVERSATION_KEY,
        kind: 'conversation',
        peerIdentityId: PEER_ID,
        version: 2,
      },
    },
    version: 1,
  },
  masterKey: { getBuffer: () => MASTER_KEY },
} as unknown as Session;

const outboxItem = {
  conversationId: 'one-to-one:1',
  id: 'envelope-1',
  record: {
    authorId: OWN_ID,
    conversationId: 'one-to-one:1',
    createdAt: 42,
    encryptedPayload: 'ciphertext',
    id: 'envelope-1',
    previousMessageIds: [],
    type: 'sent',
  },
  state: 'pending',
} satisfies DirectMessageOutboxItem;

const build = (ownLeafIdentityId = OWN_ID) =>
  SecurityAuditReport.from({
    communities: [{ id: 'community-1', name: 'Pigeons' } as Community],
    conversations: [
      { id: 'one-to-one:1', name: 'Ada' } as unknown as ConversationResource,
    ],
    devices: [pem(OTHER_DEVICE), pem(OWN_DEVICE)],
    groups: {
      'community-1': {
        epoch: 3n,
        leaves: [
          {
            owner: {
              deviceCredential: pem(OWN_DEVICE),
              identityId: ownLeafIdentityId,
            },
            signaturePublicKey: SIGNATURE_KEY,
          },
          {
            owner: { deviceCredential: pem(OTHER_DEVICE), identityId: OWN_ID },
            signaturePublicKey: SIBLING_SIGNATURE_KEY,
          },
          {
            owner: { deviceCredential: pem(PEER_DEVICE), identityId: PEER_ID },
            signaturePublicKey: PEER_SIGNATURE_KEY,
          },
        ],
      },
    },
    identityNames: { [PEER_ID]: 'Ada' },
    identityProfiles: {},
    mailboxId: (conversationId, recipientIdentityId) =>
      `${conversationId}->${recipientIdentityId === OWN_ID ? 'me' : 'peer'}`,
    outbox: [outboxItem],
    pins: {
      [IMPOSTOR_ID]: { handle: 'ada' },
      [PEER_ID]: { verifiedAt: '2025-01-01T00:00:00.000Z' },
    },
    sealedRootGeneration: 9,
    session,
  });

describe(SecurityAuditReport.name, () => {
  it('summarizes this account and device by ids and key fingerprints', () => {
    expect(build().account).toEqual({
      authorizationEpoch: 'epoch-1',
      authorizationRevision: 7,
      deviceCredentialFingerprint: fingerprintOf(OWN_DEVICE),
      deviceId: '11111111-1111-4111-8111-111111111111',
      identityId: OWN_ID,
      identityKeyFingerprint: fingerprintOf(OWN_ID),
      sealedRoot: {
        fingerprint: KeyFingerprint.ofSecret(ROOT_KEY),
        generation: 9,
      },
    });
  });

  it('lists authorized devices with this device first', () => {
    expect(build().devices).toEqual([
      {
        credentialFingerprint: fingerprintOf(OWN_DEVICE),
        current: true,
      },
      {
        credentialFingerprint: fingerprintOf(OTHER_DEVICE),
        current: false,
      },
    ]);
  });

  it('shows conversation ids, mailbox ids and key fingerprints', () => {
    expect(build().conversations).toEqual([
      {
        conversationId: 'one-to-one:1',
        incomingMailboxId: 'one-to-one:1->me',
        keyFingerprint: KeyFingerprint.ofSecret(
          Buffer.from(CONVERSATION_KEY, 'base64'),
        ),
        keyVersion: 2,
        kind: 'conversation',
        outgoingMailboxId: 'one-to-one:1->peer',
        peerIdentityId: PEER_ID,
        title: 'Ada',
      },
      {
        conversationId: 'community-1',
        incomingMailboxId: null,
        keyFingerprint: KeyFingerprint.ofSecret(
          Buffer.from(COMMUNITY_KEY, 'base64'),
        ),
        keyVersion: 2,
        kind: 'community',
        outgoingMailboxId: null,
        peerIdentityId: null,
        title: 'Pigeons',
      },
    ]);
  });

  it('marks a contact verified only by its identity key, never by a matching handle', () => {
    expect(build().contacts).toEqual([
      {
        identityId: PEER_ID,
        keyFingerprint: fingerprintOf(PEER_ID),
        name: 'Ada',
        verified: true,
      },
      {
        identityId: IMPOSTOR_ID,
        keyFingerprint: fingerprintOf(IMPOSTOR_ID),
        name: '@ada',
        verified: false,
      },
    ]);
  });

  it('lists MLS credentials per community group and marks this device, not its siblings', () => {
    expect(build().groups).toEqual([
      {
        communityId: 'community-1',
        epoch: '3',
        leaves: [
          {
            deviceCredentialFingerprint: fingerprintOf(OWN_DEVICE),
            identityId: OWN_ID,
            own: true,
            signatureKeyFingerprint:
              KeyFingerprint.ofPublicBytes(SIGNATURE_KEY),
          },
          {
            deviceCredentialFingerprint: fingerprintOf(OTHER_DEVICE),
            identityId: OWN_ID,
            own: false,
            signatureKeyFingerprint: KeyFingerprint.ofPublicBytes(
              SIBLING_SIGNATURE_KEY,
            ),
          },
          {
            deviceCredentialFingerprint: fingerprintOf(PEER_DEVICE),
            identityId: PEER_ID,
            own: false,
            signatureKeyFingerprint:
              KeyFingerprint.ofPublicBytes(PEER_SIGNATURE_KEY),
          },
        ],
        title: 'Pigeons',
      },
    ]);
  });

  it('marks this device when its leaf carries the own identity id in PEM form', () => {
    expect(build(pem(OWN_ID)).groups[0]?.leaves[0]?.own).toBe(true);
  });

  it('lists pending outbox envelopes by id', () => {
    expect(build().outbox).toEqual([
      {
        conversationId: 'one-to-one:1',
        createdAt: 42,
        envelopeId: 'envelope-1',
        state: 'pending',
      },
    ]);
  });

  it('never carries private key material', () => {
    const serialized = JSON.stringify(build(), (_key, value: unknown) =>
      typeof value === 'bigint' ? value.toString() : value,
    );

    for (const secret of [
      CONVERSATION_KEY,
      COMMUNITY_KEY,
      ROOT_KEY.toString('base64'),
      MASTER_KEY.toString('base64'),
      'device-private',
      'ciphertext',
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });
});
