import { ClientNodeEndpoint } from '../../../../shared/infrastructure/client/ClientNodeEndpoint';

describe('ClientNodeEndpoint', () => {
  it('normalizes an explicit secure node and its API prefix', () => {
    expect(
      ClientNodeEndpoint.normalize(' https://NODE.example:443/api/ '),
    ).toBe('https://node.example/api');
  });

  it.each(['http://localhost:8080/api', 'http://127.0.0.1:8080'])(
    'allows explicit loopback development nodes: %s',
    (url) => {
      expect(ClientNodeEndpoint.normalize(url)).toBe(url);
    },
  );

  it.each([
    'http://[::1]:8080',
    '',
    '/api',
    '//node.example/api',
    'http://node.example/api',
    'javascript:alert(1)',
    'https://user:password@node.example',
    'https://node.example/api?script=x',
    'https://node.example/api#key',
    'http://localhost.example:8080',
  ])('rejects unsafe or ambiguous endpoint %s', (url) => {
    expect(() => ClientNodeEndpoint.normalize(url)).toThrow();
  });
});
