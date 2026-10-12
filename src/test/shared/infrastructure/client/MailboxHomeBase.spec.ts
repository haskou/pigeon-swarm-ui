import { MailboxHomeBase } from '../../../../shared/infrastructure/client/MailboxHomeBase';

const PAGE = 'https://app.example';

describe(MailboxHomeBase.name, () => {
  it('publishes the canonical base of an absolute API base', () => {
    expect(
      MailboxHomeBase.fromApiBase(' https://NODE.example:443/ ', PAGE),
    ).toBe('https://node.example');
    expect(MailboxHomeBase.fromApiBase('http://localhost:8080/', PAGE)).toBe(
      'http://localhost:8080',
    );
  });

  it('keeps the path prefix of the API base without a trailing slash', () => {
    expect(
      MailboxHomeBase.fromApiBase('https://node.example:8443/pigeon/api', PAGE),
    ).toBe('https://node.example:8443/pigeon/api');
    expect(MailboxHomeBase.fromApiBase('https://node.example/api/', PAGE)).toBe(
      'https://node.example/api',
    );
  });

  it('resolves a relative API base against the page origin', () => {
    expect(MailboxHomeBase.fromApiBase('/api/', 'https://app.example')).toBe(
      'https://app.example/api',
    );
    expect(MailboxHomeBase.fromApiBase('/api', 'http://localhost:5173')).toBe(
      'http://localhost:5173/api',
    );
  });

  it('publishes nothing without a usable page origin for a relative base', () => {
    expect(MailboxHomeBase.fromApiBase('/api/', 'null')).toBeUndefined();
  });

  it.each([
    'https://node.example/api?',
    'https://node.example/api?x=1',
    'https://node.example/api#frag',
    'https://user:secret@node.example/api',
    'https://node.example//api',
    'http://node.example/api',
    'ftp://node.example/api',
    'not a url',
  ])('publishes nothing for API base %s', (url) => {
    expect(MailboxHomeBase.fromApiBase(url, PAGE)).toBeUndefined();
  });

  it('accepts only the canonical base form of an advertised value', () => {
    expect(MailboxHomeBase.parse('https://node.example')).toBe(
      'https://node.example',
    );
    expect(MailboxHomeBase.parse('https://node.example/api')).toBe(
      'https://node.example/api',
    );
    expect(MailboxHomeBase.parse('https://node.example:8443/pigeon/api')).toBe(
      'https://node.example:8443/pigeon/api',
    );
    expect(MailboxHomeBase.parse('http://localhost:8080')).toBe(
      'http://localhost:8080',
    );
  });

  it.each([
    undefined,
    '',
    ' https://node.example/api',
    'https://node.example/',
    'https://node.example/api/',
    'https://NODE.example/api',
    'https://node.example:443/api',
    'https://node.example/api/../x',
    'https://node.example//api',
    'https://node.example/api?',
    'https://node.example/api#frag',
    'http://node.example/api',
    `https://node.example/${'a'.repeat(250)}`,
  ])('rejects advertised value %s', (value) => {
    expect(MailboxHomeBase.parse(value)).toBeUndefined();
  });

  it.each([
    'https://10.0.0.5',
    'https://10.0.0.5/api',
    'https://172.16.0.1',
    'https://172.31.255.255',
    'https://192.168.1.10',
    'https://169.254.10.20',
    'https://127.0.0.1',
    'https://127.0.0.1/api',
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
    expect(MailboxHomeBase.fromApiBase(url, PAGE)).toBeUndefined();
  });

  it('publishes public addresses, including private range boundaries', () => {
    expect(MailboxHomeBase.fromApiBase('https://172.15.0.1', PAGE)).toBe(
      'https://172.15.0.1',
    );
    expect(MailboxHomeBase.fromApiBase('https://172.32.0.1', PAGE)).toBe(
      'https://172.32.0.1',
    );
    expect(MailboxHomeBase.fromApiBase('https://8.8.8.8', PAGE)).toBe(
      'https://8.8.8.8',
    );
    expect(MailboxHomeBase.fromApiBase('https://[2001:4860::8888]', PAGE)).toBe(
      'https://[2001:4860::8888]',
    );
  });

  it('keeps the dev localhost exception', () => {
    expect(
      MailboxHomeBase.fromApiBase('https://localhost:8443/api', PAGE),
    ).toBe('https://localhost:8443/api');
  });

  it.each(['https://10.0.0.5', 'https://[fe80::1]/api'])(
    'rejects advertised private host %s',
    (value) => {
      expect(MailboxHomeBase.parse(value)).toBeUndefined();
    },
  );
});
