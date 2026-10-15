import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { Buffer } from 'buffer';
import { createHmac, hkdfSync } from 'crypto';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { ConversationDraftCipher } from '../../../../../contexts/messages/infrastructure/crypto/ConversationDraftCipher';
import { DraftPayloadCipher } from '../../../../../contexts/messages/infrastructure/crypto/DraftPayloadCipher';

describe(ConversationDraftCipher.name, () => {
  const sessionUnder = (root: SymmetricKey): Session =>
    ({
      deviceSealedRootKey: root,
      identity: { id: 'identity-1' },
      masterKey: SymmetricKey.generate(),
    }) as unknown as Session;
  const cipher = new ConversationDraftCipher();

  it('derives the draft key as HMAC-SHA256 under the HKDF draft key of the device sealed root', () => {
    const root = Buffer.alloc(32, 7);
    const draftKeyBytes = Buffer.from(
      hkdfSync(
        'sha256',
        root,
        Buffer.alloc(0),
        'pigeon/conversation-draft-key/v1',
        32,
      ),
    );
    const expected = createHmac('sha256', draftKeyBytes)
      .update('group:conversation-1', 'utf8')
      .digest('base64url');

    expect(
      cipher.draftKey(
        sessionUnder(SymmetricKey.fromBuffer(root)),
        'group:conversation-1',
      ),
    ).toBe(expected);
  });

  it('gives each conversation and each root its own 43-character base64url key', () => {
    const session = sessionUnder(SymmetricKey.generate());
    const key = cipher.draftKey(session, 'group:conversation-1');

    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(cipher.draftKey(session, 'group:conversation-1')).toBe(key);
    expect(cipher.draftKey(session, 'group:conversation-2')).not.toBe(key);
    expect(
      cipher.draftKey(
        sessionUnder(SymmetricKey.generate()),
        'group:conversation-1',
      ),
    ).not.toBe(key);
  });

  it('opens a draft sealed for the conversation its key names', () => {
    const session = sessionUnder(SymmetricKey.generate());
    const draftKey = cipher.draftKey(session, 'group:conversation-1');

    expect(
      cipher.decrypt(
        session,
        draftKey,
        cipher.encrypt(session, 'group:conversation-1', 'draft text'),
      ),
    ).toEqual({
      content: 'draft text',
      conversationId: 'group:conversation-1',
    });
  });

  it('refuses a draft stored under the key of another conversation', () => {
    const session = sessionUnder(SymmetricKey.generate());

    expect(
      cipher.decrypt(
        session,
        cipher.draftKey(session, 'group:conversation-2'),
        cipher.encrypt(session, 'group:conversation-1', 'draft text'),
      ),
    ).toBeNull();
  });

  it('refuses a draft sealed under another root', () => {
    const session = sessionUnder(SymmetricKey.generate());
    const other = sessionUnder(SymmetricKey.generate());

    expect(
      cipher.decrypt(
        session,
        cipher.draftKey(session, 'group:conversation-1'),
        cipher.encrypt(other, 'group:conversation-1', 'draft text'),
      ),
    ).toBeNull();
  });

  it('refuses a draft sealed by another draft cipher under the same root', () => {
    const session = sessionUnder(SymmetricKey.generate());

    expect(
      cipher.decrypt(
        session,
        cipher.draftKey(session, 'group:conversation-1'),
        new DraftPayloadCipher().encrypt(session, 'channel draft'),
      ),
    ).toBeNull();
  });
});
