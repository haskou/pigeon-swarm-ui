import { KeyPair } from '@haskou/pigeon-swarm-crypto';
import { mock, type MockProxy } from 'jest-mock-extended';

import type { Session } from '../../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { PigeonPollsApi } from '../../../../../contexts/polls/infrastructure/http/PigeonPollsApi';
import { ScopeFrontierReader } from '../../../../../shared/infrastructure/http/ScopeFrontierReader';
import { publicMutationSignerAt } from '../../../../shared/infrastructure/crypto/publicMutationSignerAt';
import { pollResourceFixture } from '../../pollResourceFixture';

async function setup() {
  const http = mock<HttpJsonClient>();
  const signer = mock<RequestSigner>();
  const session = {
    deviceCredentialKeyPair: await KeyPair.generate(),
    identity: { id: 'identity-a' },
  } as unknown as Session;
  signer.headers.mockResolvedValue({});
  http.request.mockResolvedValue(pollResourceFixture());

  return {
    api: new PigeonPollsApi(http, signer, publicMutationSignerAt()),
    http,
    session,
    signer,
  };
}

function sentBody(http: MockProxy<HttpJsonClient>) {
  const [, init] = http.request.mock.calls[0];

  return JSON.parse(init?.body as string) as {
    mutation: {
      kind: string;
      recordId: string;
      sequence: number;
      store: string;
    };
  } & Record<string, unknown>;
}

beforeEach(() => {
  jest
    .spyOn(ScopeFrontierReader.prototype, 'community')
    .mockResolvedValue(['F'.repeat(43)]);
  jest
    .spyOn(ScopeFrontierReader.prototype, 'conversation')
    .mockResolvedValue(['F'.repeat(43)]);
});

describe(PigeonPollsApi.name, () => {
  it('signs a vote as a put of the voter ballot record', async () => {
    const { api, http, session, signer } = await setup();

    await api.vote(
      session,
      'poll/a',
      { conversationId: 'conversation-a' },
      ['option-a'],
      200,
    );

    const body = sentBody(http);
    expect(body).toMatchObject({ createdAt: 200, optionIds: ['option-a'] });
    expect(body.mutation).toMatchObject({
      kind: 'put',
      recordId: 'poll-vote:poll/a:identity-a',
      sequence: 0,
      store: 'polls',
    });
    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'POST',
      '/polls/poll%2Fa/votes',
      body,
    );
  });

  it('signs vote removal as a delete tombstone', async () => {
    const { api, http, session } = await setup();

    await api.removeVote(session, 'poll-a', {
      conversationId: 'conversation-a',
    });

    expect(http.request.mock.calls[0][1]?.method).toBe('DELETE');
    expect(sentBody(http).mutation).toMatchObject({
      kind: 'delete',
      recordId: 'poll-vote:poll-a:identity-a',
    });
    expect(sentBody(http).mutation).toMatchObject({
      frontier: ['F'.repeat(43)],
    });
  });

  it('signs close as a put of the close record', async () => {
    const { api, http, session } = await setup();

    await api.close(session, 'poll-a', { conversationId: 'c' }, 300);

    const body = sentBody(http);
    expect(body.createdAt).toBe(300);
    expect(body.mutation).toMatchObject({
      kind: 'put',
      recordId: 'poll-close:poll-a',
    });
  });

  it('signs creation with the client-chosen poll id as record id', async () => {
    const { api, http, session } = await setup();

    await api.create(session, {
      allowsMultipleVotes: false,
      conversationId: 'conversation-a',
      createdAt: 100,
      expiresAt: null,
      options: [{ id: 'option-a', text: 'A' }],
      pollId: 'poll-a',
      question: 'Choose?',
      scopeType: 'group_conversation',
    });

    const body = sentBody(http);
    expect(body.pollId).toBe('poll-a');
    expect(body.mutation).toMatchObject({ kind: 'put', recordId: 'poll-a' });
  });

  it('signs a messages-store timeline record alongside the poll', async () => {
    const { api, http, session } = await setup();

    await api.create(session, {
      allowsMultipleVotes: false,
      channelId: 'channel-a',
      communityId: 'community-a',
      createdAt: 100,
      expiresAt: null,
      options: [{ id: 'option-a', text: 'A' }],
      pollId: 'poll-a',
      question: 'Choose?',
      scopeType: 'community_channel',
    });

    expect(sentBody(http).timelineMutation).toMatchObject({
      kind: 'put',
      recordId: `community:community-a:channel-a:poll-a:${session.identity.id}`,
      store: 'messages',
    });
  });
});
