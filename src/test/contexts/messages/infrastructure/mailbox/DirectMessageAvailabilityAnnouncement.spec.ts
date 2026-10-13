import { DirectMessageAvailabilityAnnouncement } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageAvailabilityAnnouncement';

describe(DirectMessageAvailabilityAnnouncement.name, () => {
  const announcement = {
    authorId: 'bob',
    conversationId: 'conversation-1',
    createdAt: 1_700_000_000_000,
    servers: ['https://a.example', 'https://b.example/api'],
  };
  const raw = (value: Record<string, unknown>): Uint8Array =>
    new TextEncoder().encode(JSON.stringify(value));
  const wire = {
    ...announcement,
    kind: 'direct-mailbox-servers',
    version: 1,
  };

  it('round-trips an announcement', () => {
    expect(
      DirectMessageAvailabilityAnnouncement.decode(
        DirectMessageAvailabilityAnnouncement.encode(announcement),
        'conversation-1',
      ),
    ).toEqual(announcement);
  });

  it('round-trips an empty server list', () => {
    const empty = { ...announcement, servers: [] };

    expect(
      DirectMessageAvailabilityAnnouncement.decode(
        DirectMessageAvailabilityAnnouncement.encode(empty),
        'conversation-1',
      ),
    ).toEqual(empty);
  });

  it('ignores an announcement for another conversation', () => {
    expect(
      DirectMessageAvailabilityAnnouncement.decode(
        DirectMessageAvailabilityAnnouncement.encode(announcement),
        'conversation-2',
      ),
    ).toBeNull();
  });

  it.each([
    ['a direct message record', { ...wire, kind: 'direct-message' }],
    ['an unknown version', { ...wire, version: 2 }],
    ['a missing author', { ...wire, authorId: '' }],
    ['a non-integer timestamp', { ...wire, createdAt: 1.5 }],
    ['a private host', { ...wire, servers: ['https://10.0.0.2'] }],
    [
      'a duplicate server',
      { ...wire, servers: ['https://a.example', 'https://a.example'] },
    ],
    [
      'more than three servers',
      {
        ...wire,
        servers: [
          'https://a.example',
          'https://b.example',
          'https://c.example',
          'https://d.example',
        ],
      },
    ],
  ])('rejects %s', (_label, value) => {
    expect(
      DirectMessageAvailabilityAnnouncement.decode(
        raw(value),
        'conversation-1',
      ),
    ).toBeNull();
  });

  it('rejects bytes that are not JSON', () => {
    expect(
      DirectMessageAvailabilityAnnouncement.decode(
        new Uint8Array([0xff, 0x00]),
        'conversation-1',
      ),
    ).toBeNull();
  });
});
