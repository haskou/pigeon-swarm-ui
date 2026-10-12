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
});
