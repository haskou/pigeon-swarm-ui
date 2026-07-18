import { mock } from 'jest-mock-extended';

import type { Session } from '../../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { PigeonPollsApi } from '../../../../../contexts/polls/infrastructure/http/PigeonPollsApi';
import { pollResourceFixture } from '../../pollResourceFixture';

describe(PigeonPollsApi.name, () => {
  it('signs the exact poll vote request', async () => {
    const http = mock<HttpJsonClient>();
    const signer = mock<RequestSigner>();
    const session = {
      identity: { id: 'identity-a' },
    } as unknown as Session;
    const body = { optionIds: ['option-a'] };
    signer.headers.mockResolvedValue({});
    http.request.mockResolvedValue(pollResourceFixture());

    await new PigeonPollsApi(http, signer).vote(
      session,
      'poll/a',
      body.optionIds,
    );

    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'POST',
      '/polls/poll%2Fa/votes',
      body,
    );
  });
});
