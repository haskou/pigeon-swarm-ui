import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';

import { CommunityMentionHighlightPolicy } from '../../../../contexts/communities/domain/CommunityMentionHighlightPolicy';

const message = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  attachments: [],
  authorIdentityId: 'identity-a',
  content: 'hello',
  encrypted: false,
  id: 'message-a',
  mine: false,
  raw: { id: 'message-a', type: 'sent' },
  reactions: [],
  timestamp: 100,
  ...overrides,
});

describe(CommunityMentionHighlightPolicy.name, () => {
  it('highlights direct mentions to the current identity', () => {
    expect(
      CommunityMentionHighlightPolicy.mentionsIdentity(
        message({
          mentions: [{ targetId: 'identity-b', type: 'identity' }],
        }),
        'identity-b',
        new Set(),
      ),
    ).toBe(true);
  });

  it('highlights everyone mentions', () => {
    expect(
      CommunityMentionHighlightPolicy.mentionsIdentity(
        message({ mentions: [{ type: 'everyone' }] }),
        'identity-b',
        new Set(),
      ),
    ).toBe(true);
  });

  it('highlights here mentions', () => {
    expect(
      CommunityMentionHighlightPolicy.mentionsIdentity(
        message({ mentions: [{ type: 'here' }] }),
        'identity-b',
        new Set(),
      ),
    ).toBe(true);
  });

  it('highlights role mentions assigned to the current identity', () => {
    expect(
      CommunityMentionHighlightPolicy.mentionsIdentity(
        message({
          mentions: [{ targetId: 'role-a', type: 'role' }],
        }),
        'identity-b',
        new Set(['role-a']),
      ),
    ).toBe(true);
  });

  it('ignores role mentions not assigned to the current identity', () => {
    expect(
      CommunityMentionHighlightPolicy.mentionsIdentity(
        message({
          mentions: [{ targetId: 'role-a', type: 'role' }],
        }),
        'identity-b',
        new Set(['role-b']),
      ),
    ).toBe(false);
  });

  it('does not highlight messages authored by the current identity', () => {
    expect(
      CommunityMentionHighlightPolicy.mentionsIdentity(
        message({
          authorIdentityId: 'identity-b',
          mentions: [{ type: 'everyone' }],
        }),
        'identity-b',
        new Set(),
      ),
    ).toBe(false);
  });
});
