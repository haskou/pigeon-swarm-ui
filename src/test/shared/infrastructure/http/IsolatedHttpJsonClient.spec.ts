import { PigeonMailboxClient } from '../../../../contexts/mailboxes/infrastructure/http/PigeonMailboxClient';
import { ApiUrlBuilder } from '../../../../shared/infrastructure/http/ApiUrlBuilder';
import { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';

describe('isolated HTTP client', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it.each(['json', 'blob'])(
    'omits credentials and refuses redirects for %s requests even with caller overrides',
    async (kind) => {
      globalThis.fetch = jest.fn().mockResolvedValue(
        new Response('{}', {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const client = new HttpJsonClient(
        new ApiUrlBuilder('https://peer.example'),
        { isolated: true },
      );
      const init: RequestInit = { credentials: 'include', redirect: 'follow' };

      if (kind === 'json') await client.request('/resource', init);
      else await client.requestBlob('/resource', init);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://peer.example/resource',
        expect.objectContaining({ credentials: 'omit', redirect: 'error' }),
      );
    },
  );

  it('leaves the local client on the browser defaults', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      new Response('{}', {
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await new HttpJsonClient(new ApiUrlBuilder('https://node.example')).request(
      '/resource',
    );

    const [, init] = (globalThis.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];

    expect(init).not.toHaveProperty('credentials');
    expect(init).not.toHaveProperty('redirect');
  });

  it('sends a foreign append with only the post-token bearer and no ambient credentials', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      new Response('{"cursor":7}', {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const mailboxes = new PigeonMailboxClient(
      new HttpJsonClient(new ApiUrlBuilder('https://peer.example'), {
        isolated: true,
      }),
    );

    await expect(
      mailboxes.append('mailbox-1', 'post-token', {
        body: 'sealed',
        envelopeId: 'envelope-1',
      }),
    ).resolves.toEqual({ cursor: 7 });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://peer.example/mailboxes/mailbox-1/envelopes',
      expect.objectContaining({
        credentials: 'omit',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer post-token',
          'Content-Type': 'application/json',
        },
        method: 'POST',
        redirect: 'error',
      }),
    );
  });
});
