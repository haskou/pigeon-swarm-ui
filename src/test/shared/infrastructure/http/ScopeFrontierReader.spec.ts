import { mock } from 'jest-mock-extended';

import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';

import { ScopeFrontierReader } from '../../../../shared/infrastructure/http/ScopeFrontierReader';

const FRONTIER = ['F'.repeat(43)];

function setup() {
  const http = mock<HttpJsonClient>();
  const signer = mock<RequestSigner>();
  const session = { identity: { id: 'identity-a' } } as unknown as Session;
  signer.headers.mockResolvedValue({ authorization: 'signed' });
  http.request.mockResolvedValue({ frontier: FRONTIER });

  return {
    http,
    reader: new ScopeFrontierReader(http, signer),
    session,
    signer,
  };
}

describe(ScopeFrontierReader.name, () => {
  it('reads the frontier of a community with a signed request', async () => {
    const { http, reader, session, signer } = setup();

    await expect(reader.community(session, 'community/a')).resolves.toEqual(
      FRONTIER,
    );

    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'GET',
      '/communities/community%2Fa/frontier',
    );
    expect(http.request).toHaveBeenCalledWith(
      '/communities/community%2Fa/frontier',
      { headers: { authorization: 'signed' }, method: 'GET' },
    );
  });

  it('reads no conversation frontier, which the node no longer serves', () => {
    expect(ScopeFrontierReader.prototype).not.toHaveProperty('conversation');
    expect(ScopeFrontierReader.prototype).not.toHaveProperty('ofPayload');
  });
});
