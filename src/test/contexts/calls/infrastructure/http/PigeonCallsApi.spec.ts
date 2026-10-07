import type { Session } from '../../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { CallEventSigner } from '../../../../../contexts/calls/infrastructure/http/CallEventSigner';
import { PigeonCallsApi } from '../../../../../contexts/calls/infrastructure/http/PigeonCallsApi';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';

const session = { identity: { id: 'identity-a' } } as Session;
const mutation = { signature: 'sig' } as never;

function build(responses: unknown[]) {
  const request = jest.fn();

  responses.forEach((response) => {
    if (response instanceof Error) request.mockRejectedValueOnce(response);
    else request.mockResolvedValueOnce(response);
  });
  const events = new CallEventSigner();
  const signer = {
    headers: jest.fn().mockResolvedValue({}),
  } as unknown as RequestSigner;
  const scopes = {
    communityNetworkId: jest.fn().mockResolvedValue('network-a'),
    conversation: jest.fn().mockResolvedValue({
      networkId: 'network-a',
      participantIds: ['identity-b', 'identity-a'],
    }),
  };
  const api = new PigeonCallsApi(
    { request } as unknown as HttpJsonClient,
    signer,
    events,
    scopes,
  );

  return { api, events, request, signer };
}

const bodyOf = (request: jest.Mock, call: number): Record<string, unknown> =>
  JSON.parse(
    (request.mock.calls[call] as [string, { body: string }])[1].body,
  ) as Record<string, unknown>;

describe(PigeonCallsApi.name, () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends a signed conversation start with sorted participants', async () => {
    const { api, events, request } = build([{ id: 'call-a' }]);
    const start = jest.spyOn(events, 'start').mockReturnValue({
      callId: 'call-a',
      mutation,
    });

    await api.startConversation(session, 'conversation-a', 5);

    expect(start.mock.calls[0]?.[1]).toMatchObject({
      networkId: 'network-a',
      participantIds: ['identity-b', 'identity-a'],
      scope: { conversationId: 'conversation-a', type: 'conversation' },
      startedAt: 5,
    });
    expect(bodyOf(request, 0)).toMatchObject({
      conversationId: 'conversation-a',
      mutation,
      scopeType: 'conversation',
      startedAt: 5,
    });
    expect(bodyOf(request, 0).nonce).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
  });

  it('joins the live community call instead of starting a second one', async () => {
    const { api, events, request } = build([
      {
        calls: [
          {
            id: 'call-live',
            scope: {
              channelId: 'channel-a',
              communityId: 'community-a',
              type: 'community_channel',
            },
            sessionEpoch: 4,
          },
        ],
      },
      { id: 'call-live' },
      { id: 'call-live' },
    ]);

    jest.spyOn(events, 'start').mockReturnValue({ callId: 'mine', mutation });
    const participant = jest
      .spyOn(events, 'participant')
      .mockReturnValue(mutation);

    await api.startCommunityChannel(session, 'community-a', 'channel-a', 9);

    expect(bodyOf(request, 1)).toMatchObject({
      scopeType: 'community_channel',
      sessionEpoch: 5,
    });
    expect(participant).toHaveBeenCalledWith(
      session,
      'call-live',
      'joined',
      9,
      { predecessor: null, sequence: 0 },
    );
    expect(request.mock.calls[2]?.[0]).toBe('/calls/call-live/participants');
    expect(bodyOf(request, 2)).toEqual({ at: 9, mutation });
  });

  it('signs leave states and end', async () => {
    const { api, events, request } = build([undefined, undefined, undefined]);
    const participant = jest
      .spyOn(events, 'participant')
      .mockReturnValue(mutation);

    jest.spyOn(events, 'end').mockReturnValue(mutation);
    await api.leave(session, 'call-a', 6, true);
    await api.leave(session, 'call-a', 7, false);
    await api.end(session, 'call-a', 8);

    expect(participant.mock.calls.map((call) => call[2])).toEqual([
      'declined',
      'left',
    ]);
    expect(request.mock.calls[0]?.[1]).toMatchObject({ method: 'DELETE' });
    expect(bodyOf(request, 0)).toEqual({ at: 6, mutation });
    expect(bodyOf(request, 2)).toEqual({ at: 8, mutation });
  });

  it('re-signs a participant state after a stale position', async () => {
    const stale = new HttpJsonError(
      409,
      'Conflict',
      JSON.stringify({
        code: 'StalePublicMutationError',
        details: { digest: 'digest-a', sequence: 3 },
      }),
    );
    const { api, events, request } = build([stale, undefined]);
    const participant = jest
      .spyOn(events, 'participant')
      .mockReturnValue(mutation);

    await api.leave(session, 'call-a', 6, false);

    expect(request).toHaveBeenCalledTimes(2);
    expect(participant.mock.calls[1]?.[4]).toEqual({
      predecessor: 'digest-a',
      sequence: 4,
    });
  });
});
