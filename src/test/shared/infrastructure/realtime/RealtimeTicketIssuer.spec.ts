import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { ApiUrlBuilder } from '../../../../shared/infrastructure/http/ApiUrlBuilder';
import { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';
import { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import { RealtimeConnectionUrl } from '../../../../shared/infrastructure/realtime/RealtimeConnectionUrl';
import { RealtimeTicketIssuer } from '../../../../shared/infrastructure/realtime/RealtimeTicketIssuer';

function response(status: number, body: unknown): Response {
  return {
    json: jest.fn().mockResolvedValue(body),
    ok: status < 400,
    status,
    statusText: '',
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

function session(
  sign = jest.fn().mockResolvedValue({ toString: () => 'sig' }),
) {
  return {
    authorizationEpoch: { valueOf: () => 7 },
    authorizationRevision: { valueOf: () => 3 },
    deviceCredentialKeyPair: {
      sign: jest.fn().mockReturnValue({ toString: () => 'device-signature' }),
      toPrimitives: () => ({ publicKey: 'device-public-key' }),
    },
    identity: { id: 'identity-1' },
    keyPair: { sign },
    password: 'secret',
  } as unknown as Session;
}

function issuer(
  base = 'http://localhost:8080/api/',
  signer = new RequestSigner(() => 123),
): RealtimeTicketIssuer {
  const urls = new ApiUrlBuilder(base);

  return new RealtimeTicketIssuer(
    new HttpJsonClient(urls),
    signer,
    new RealtimeConnectionUrl(urls),
  );
}

describe(RealtimeTicketIssuer.name, () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('posts a signed empty body to the prefixed tickets path', async () => {
    const sign = jest.fn().mockResolvedValue({ toString: () => 'signature' });
    const signer = new RequestSigner(() => 123);
    global.fetch = jest
      .fn()
      .mockResolvedValue(response(201, { expiresAt: 1, ticket: 'ticket-a' }));

    await issuer('http://localhost:8080/api/', signer).issue(session(sign));

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/realtime/v1/tickets',
      expect.objectContaining({
        body: '{}',
        headers: expect.objectContaining({
          'X-Identity-Id': 'identity-1',
          'X-Signature': 'signature',
          'X-Timestamp': '123',
        }),
        method: 'POST',
      }),
    );
    expect(sign).toHaveBeenCalledWith(
      signer.payload('POST', '/api/realtime/v1/tickets', 123, {}),
    );
  });

  it('returns the issued ticket', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        response(201, { expiresAt: 1, ticket: 'abc_DEF-123' }),
      );

    await expect(issuer().issue(session())).resolves.toBe('abc_DEF-123');
  });

  it('requests a new ticket for every call', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(response(201, { expiresAt: 1, ticket: 'first' }))
      .mockResolvedValueOnce(response(201, { expiresAt: 2, ticket: 'second' }));
    const ticketIssuer = issuer();

    await expect(ticketIssuer.issue(session())).resolves.toBe('first');
    await expect(ticketIssuer.issue(session())).resolves.toBe('second');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['missing', {}],
    ['empty', { ticket: '' }],
    ['not base64url', { ticket: 'not base64url!' }],
    ['not a string', { ticket: 42 }],
  ])('refuses a response with a %s ticket', async (_label, body) => {
    global.fetch = jest.fn().mockResolvedValue(response(201, body));

    await expect(issuer().issue(session())).rejects.toThrow(
      'Realtime ticket response is invalid',
    );
  });

  it('propagates a refused ticket request', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(response(429, { code: '429050' }));

    await expect(issuer().issue(session())).rejects.toBeInstanceOf(
      HttpJsonError,
    );
  });
});
