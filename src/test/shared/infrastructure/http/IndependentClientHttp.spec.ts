import { ApiUrlBuilder } from '../../../../shared/infrastructure/http/ApiUrlBuilder';
import { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';

jest.mock(
  '../../../../shared/infrastructure/client/isIndependentClient',
  () => ({ isIndependentClient: () => true }),
);

describe('independent client HTTP policy', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it.each(['json', 'blob'])(
    'rejects redirects and ambient cookies for %s requests even with caller overrides',
    async (kind) => {
      globalThis.fetch = jest.fn().mockResolvedValue(
        new Response('{}', {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const client = new HttpJsonClient(
        new ApiUrlBuilder('https://node.example/api'),
      );
      const init: RequestInit = { credentials: 'include', redirect: 'follow' };

      if (kind === 'json') await client.request('/resource', init);
      else await client.requestBlob('/resource', init);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://node.example/api/resource',
        expect.objectContaining({ credentials: 'omit', redirect: 'error' }),
      );
    },
  );
});
