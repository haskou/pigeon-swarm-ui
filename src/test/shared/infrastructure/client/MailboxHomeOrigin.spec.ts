import { MailboxHomeOrigin } from '../../../../shared/infrastructure/client/MailboxHomeOrigin';

describe(MailboxHomeOrigin.name, () => {
  it('publishes the canonical origin of a root node endpoint', () => {
    expect(
      MailboxHomeOrigin.fromNodeEndpoint(' https://NODE.example:443/ '),
    ).toBe('https://node.example');
    expect(MailboxHomeOrigin.fromNodeEndpoint('http://localhost:8080/')).toBe(
      'http://localhost:8080',
    );
  });

  it.each([
    'https://node.example/api',
    'http://node.example',
    'ftp://node.example',
    'not a url',
  ])('publishes nothing for endpoint %s', (url) => {
    expect(MailboxHomeOrigin.fromNodeEndpoint(url)).toBeUndefined();
  });

  it('accepts only the canonical origin form of an advertised value', () => {
    expect(MailboxHomeOrigin.parse('https://node.example')).toBe(
      'https://node.example',
    );
    expect(MailboxHomeOrigin.parse('http://localhost:8080')).toBe(
      'http://localhost:8080',
    );
  });

  it.each([
    undefined,
    '',
    'https://node.example/',
    'https://NODE.example',
    'https://node.example/api',
    'http://node.example',
  ])('rejects advertised value %s', (value) => {
    expect(MailboxHomeOrigin.parse(value)).toBeUndefined();
  });

  it.each([
    'https://10.0.0.5',
    'https://172.16.0.1',
    'https://172.31.255.255',
    'https://192.168.1.10',
    'https://169.254.10.20',
    'https://127.0.0.1',
    'https://0.0.0.0',
    'https://[::]',
    'https://[::1]',
    'https://[fe80::1]',
    'https://[fd12:3456::1]',
    'https://[fc00::1]',
    'https://[::ffff:7f00:1]',
    'http://127.0.0.1:8080',
    'http://10.0.0.5',
  ])('publishes nothing for private or link-local host %s', (url) => {
    expect(MailboxHomeOrigin.fromNodeEndpoint(url)).toBeUndefined();
  });

  it('publishes public addresses, including private range boundaries', () => {
    expect(MailboxHomeOrigin.fromNodeEndpoint('https://172.15.0.1')).toBe(
      'https://172.15.0.1',
    );
    expect(MailboxHomeOrigin.fromNodeEndpoint('https://172.32.0.1')).toBe(
      'https://172.32.0.1',
    );
    expect(MailboxHomeOrigin.fromNodeEndpoint('https://8.8.8.8')).toBe(
      'https://8.8.8.8',
    );
    expect(
      MailboxHomeOrigin.fromNodeEndpoint('https://[2001:4860::8888]'),
    ).toBe('https://[2001:4860::8888]');
  });

  it('keeps the dev localhost exception', () => {
    expect(MailboxHomeOrigin.fromNodeEndpoint('https://localhost:8443')).toBe(
      'https://localhost:8443',
    );
  });

  it.each(['https://10.0.0.5', 'https://[fe80::1]'])(
    'rejects advertised private host %s',
    (value) => {
      expect(MailboxHomeOrigin.parse(value)).toBeUndefined();
    },
  );
});
