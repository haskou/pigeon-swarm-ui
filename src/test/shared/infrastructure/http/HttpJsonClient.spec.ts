import { ApiUrlBuilder } from '../../../../shared/infrastructure/http/ApiUrlBuilder';
import { HttpConnectionError } from '../../../../shared/infrastructure/http/HttpConnectionError';
import { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';

describe(HttpJsonClient.name, () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('disables browser cache revalidation by default', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      text: jest.fn().mockResolvedValue('{"ok":true}'),
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
      text: jest.fn().mockResolvedValue(''),
    } as unknown as Response);
    const client = new HttpJsonClient(new ApiUrlBuilder('http://localhost'));

    await expect(client.request('/identities/abc')).resolves.toBeUndefined();
    expect(json).not.toHaveBeenCalled();
  });

  it.each([204, 304])(
    'reads the empty %i body to completion so the request finishes',
    async (status) => {
      const cancel = jest.fn().mockResolvedValue(undefined);
      const text = jest.fn().mockResolvedValue('');
      global.fetch = jest.fn().mockResolvedValue({
        body: { cancel },
        ok: true,
        status,
        text,
      } as unknown as Response);
      const client = new HttpJsonClient(new ApiUrlBuilder('http://localhost'));

      await expect(
        client.request('/acks/abc', { method: 'POST' }),
      ).resolves.toBeUndefined();
      expect(text).toHaveBeenCalledTimes(1);
      expect(cancel).not.toHaveBeenCalled();
    },
  );

  it('treats an empty success body as no content', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: jest
        .fn()
        .mockRejectedValue(new SyntaxError('Unexpected end of JSON input')),
      ok: true,
      status: 201,
      text: jest.fn().mockResolvedValue(''),
    } as unknown as Response);
    const client = new HttpJsonClient(new ApiUrlBuilder('http://localhost'));

    await expect(
      client.request('/mailboxes/abc', { method: 'PUT' }),
    ).resolves.toBeUndefined();
  });

  it('keeps JSON content type for string bodies with signed headers', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      text: jest.fn().mockResolvedValue('{"ok":true}'),
      ok: true,
      status: 200,
    } as unknown as Response);
    const client = new HttpJsonClient(new ApiUrlBuilder('http://localhost'));

    await client.request('/keychains/', {
      body: JSON.stringify({ ok: true }),
      headers: { 'X-Signature': 'signature' },
      method: 'POST',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost/keychains/',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Signature': 'signature',
        }),
      }),
    );
  });

  it('preserves explicit content type for raw uploads', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      text: jest.fn().mockResolvedValue('{"cid":"bafy-avatar"}'),
      ok: true,
      status: 200,
    } as unknown as Response);
    const client = new HttpJsonClient(new ApiUrlBuilder('http://localhost'));
    const body = new Uint8Array([1, 2, 3]).buffer;

    await client.request('/ipfs/contents', {
      body,
      headers: { 'Content-Type': 'image/png', 'X-Filename': 'avatar.png' },
      method: 'POST',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost/ipfs/contents',
      expect.objectContaining({
        body,
        headers: expect.objectContaining({
          Accept: 'application/json',
          'Content-Type': 'image/png',
          'X-Filename': 'avatar.png',
        }),
      }),
    );
  });

  it('exposes structured API error details', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: jest
        .fn()
        .mockResolvedValue(
          '{"code":"KeychainNotFoundError","message":"Not found"}',
        ),
    } as unknown as Response);
    const client = new HttpJsonClient(new ApiUrlBuilder('http://localhost'));

    await expect(client.request('/keychains/abc')).rejects.toMatchObject({
      code: 'KeychainNotFoundError',
      message:
        '404 Not Found · {"code":"KeychainNotFoundError","message":"Not found"}',
      status: 404,
    } satisfies Partial<HttpJsonError>);
  });

  it('reports a request that never reached the node as a connection error', async () => {
    const refused = new TypeError('Failed to fetch');
    global.fetch = jest.fn().mockRejectedValue(refused);
    const client = new HttpJsonClient(new ApiUrlBuilder('http://localhost'));
    const request = client.request('/communities');

    await expect(request).rejects.toBeInstanceOf(HttpConnectionError);
    await expect(request).rejects.toBeInstanceOf(TypeError);
    await expect(request).rejects.toMatchObject({ cause: refused });
  });

  it('reports a blob request that never reached the node as a connection error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Load failed'));
    const client = new HttpJsonClient(new ApiUrlBuilder('http://localhost'));

    await expect(client.requestBlob('/files/abc')).rejects.toBeInstanceOf(
      HttpConnectionError,
    );
  });

  it('passes an aborted request through unchanged', async () => {
    const aborted = new DOMException('The user aborted.', 'AbortError');
    global.fetch = jest.fn().mockRejectedValue(aborted);
    const client = new HttpJsonClient(new ApiUrlBuilder('http://localhost'));

    await expect(client.request('/communities')).rejects.toBe(aborted);
  });
});
