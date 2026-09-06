import { ClientCompatibilityProbe } from '../../../../shared/infrastructure/client/ClientCompatibilityProbe';

describe('ClientCompatibilityProbe', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('accepts the declared major contract without sending credentials or following redirects', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ apiVersion: 1, protocol: 'pigeon-swarm' }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
      );
    await expect(
      new ClientCompatibilityProbe().verify('https://node.example/api'),
    ).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://node.example/api/client-contract',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
      }),
    );
  });

  it.each([
    { apiVersion: 2, protocol: 'pigeon-swarm' },
    { apiVersion: 1, protocol: 'other' },
    {},
    { apiVersion: '1', protocol: 'pigeon-swarm' },
  ])('rejects an incompatible declaration', async (body) => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await expect(
      new ClientCompatibilityProbe().verify('https://node.example'),
    ).rejects.toMatchObject({ code: 'incompatible' });
  });

  it('does not expose a failed backend response as a user-facing error', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response('private server detail', { status: 500 }),
      );
    await expect(
      new ClientCompatibilityProbe().verify('https://node.example'),
    ).rejects.toMatchObject({
      code: 'unreachable',
      message: 'The node could not be reached securely.',
    });
  });

  it('rejects oversized declarations', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(' '.repeat(5000), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await expect(
      new ClientCompatibilityProbe().verify('https://node.example'),
    ).rejects.toMatchObject({ code: 'incompatible' });
  });
  it('reports malformed JSON from a reachable node as an incompatible contract', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      new Response('{"protocol":', {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await expect(
      new ClientCompatibilityProbe().verify('https://node.example'),
    ).rejects.toMatchObject({ code: 'incompatible' });
  });

  it('keeps interrupted response streams classified as unreachable', async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.error(new Error('Connection reset'));
      },
    });
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(body, { headers: { 'Content-Type': 'application/json' } }),
      );
    await expect(
      new ClientCompatibilityProbe().verify('https://node.example'),
    ).rejects.toMatchObject({ code: 'unreachable' });
  });
});
