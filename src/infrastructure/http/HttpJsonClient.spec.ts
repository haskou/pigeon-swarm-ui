import { ApiUrlBuilder } from './ApiUrlBuilder';
import { HttpJsonClient } from './HttpJsonClient';

describe(HttpJsonClient.name, () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('disables browser cache revalidation by default', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({ ok: true }),
      ok: true,
      status: 200,
    } as unknown as Response);
    const client = new HttpJsonClient(new ApiUrlBuilder('http://localhost'));

    await client.request('/identities/abc');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost/identities/abc',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('does not try to parse a 304 response body', async () => {
    const json = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      json,
      ok: true,
      status: 304,
    } as unknown as Response);
    const client = new HttpJsonClient(new ApiUrlBuilder('http://localhost'));

    await expect(client.request('/identities/abc')).resolves.toBeUndefined();
    expect(json).not.toHaveBeenCalled();
  });
});
