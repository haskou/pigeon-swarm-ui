import { MailboxAvailabilityServers } from '../../../../shared/infrastructure/client/MailboxAvailabilityServers';

describe(MailboxAvailabilityServers.name, () => {
  const origin = 'https://app.example';
  const connected = 'https://node.example/api';
  const unusedOrigin = () => {
    throw new Error('page origin read');
  };

  describe('pick', () => {
    it('picks none and never reads the page origin when nothing is configured', () => {
      expect(
        MailboxAvailabilityServers.pick('', connected, unusedOrigin),
      ).toEqual([]);
      expect(
        MailboxAvailabilityServers.pick(' , ', connected, unusedOrigin),
      ).toEqual([]);
    });

    it('picks the canonical base of each configured server', () => {
      expect(
        MailboxAvailabilityServers.pick(
          ' https://a.example/ , https://b.example/api ',
          connected,
          () => origin,
        ),
      ).toEqual(['https://a.example', 'https://b.example/api']);
    });

    it('skips the connected node, duplicates, and non-public hosts', () => {
      expect(
        MailboxAvailabilityServers.pick(
          [
            'https://node.example/api/',
            'https://a.example',
            'https://a.example/',
            'http://a.example',
            'https://10.0.0.2',
            'https://user@b.example',
            'https://b.example',
          ].join(','),
          connected,
          () => origin,
        ),
      ).toEqual(['https://a.example', 'https://b.example']);
    });

    it('caps the pick at three servers', () => {
      expect(
        MailboxAvailabilityServers.pick(
          'https://a.example,https://b.example,https://c.example,https://d.example',
          connected,
          () => origin,
        ),
      ).toEqual([
        'https://a.example',
        'https://b.example',
        'https://c.example',
      ]);
    });
  });

  describe('parse', () => {
    it('accepts a list of at most three unique canonical bases', () => {
      expect(
        MailboxAvailabilityServers.parse([
          'https://a.example',
          'https://b.example/api',
        ]),
      ).toEqual(['https://a.example', 'https://b.example/api']);
      expect(MailboxAvailabilityServers.parse([])).toEqual([]);
    });

    it.each([
      ['a non-array', 'https://a.example'],
      ['a non-string entry', [1]],
      ['a non-canonical base', ['https://a.example/']],
      ['a private host', ['https://192.168.1.2']],
      ['plain http', ['http://a.example']],
      ['a duplicate', ['https://a.example', 'https://a.example']],
      [
        'more than three servers',
        [
          'https://a.example',
          'https://b.example',
          'https://c.example',
          'https://d.example',
        ],
      ],
    ])('rejects %s', (_label, value) => {
      expect(MailboxAvailabilityServers.parse(value)).toBeUndefined();
    });
  });
});
