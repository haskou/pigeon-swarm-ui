import type { IdentityResource } from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';

import { PigeonIdentityGateway } from './PigeonIdentityGateway';

describe(PigeonIdentityGateway.name, () => {
  function identity(id = 'identity-1'): IdentityResource {
    return { id } as IdentityResource;
  }

  function httpDouble(): jest.Mocked<HttpJsonClient> {
    return { request: jest.fn() } as unknown as jest.Mocked<HttpJsonClient>;
  }

  it('serves remembered identities without another request', async () => {
    const http = httpDouble();
    const gateway = new PigeonIdentityGateway(http);
    const remembered = identity();

    gateway.remember(remembered);

    await expect(gateway.get(remembered.id)).resolves.toBe(remembered);
    expect(http.request).not.toHaveBeenCalled();
  });

  it('deduplicates concurrent identity requests', async () => {
    const http = httpDouble();
    const gateway = new PigeonIdentityGateway(http);
    let resolveRequest: ((value: IdentityResource) => void) | undefined;
    http.request.mockReturnValue(
      new Promise<IdentityResource>((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const first = gateway.refresh('identity-1');
    const second = gateway.refresh('identity-1');
    const response = identity();
    resolveRequest?.(response);

    await expect(Promise.all([first, second])).resolves.toEqual([
      response,
      response,
    ]);
    expect(http.request).toHaveBeenCalledTimes(1);
  });

  it('remembers the normalized lookup alias returned by the API', async () => {
    const http = httpDouble();
    const gateway = new PigeonIdentityGateway(http);
    const response = identity('canonical-identity');
    http.request.mockResolvedValue(response);

    await gateway.refresh('lookup-identity');
    await gateway.get('lookup-identity');

    expect(http.request).toHaveBeenCalledTimes(1);
  });

  it('allows retrying after an identity request fails', async () => {
    const http = httpDouble();
    const gateway = new PigeonIdentityGateway(http);
    http.request
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(identity());

    await expect(gateway.refresh('identity-1')).rejects.toThrow('offline');
    await expect(gateway.refresh('identity-1')).resolves.toEqual(identity());
    expect(http.request).toHaveBeenCalledTimes(2);
  });
});
