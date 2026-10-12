import { mock } from 'jest-mock-extended';

import { MailboxCreationDifficultyError } from '../../../../../contexts/mailboxes/infrastructure/http/MailboxCreationDifficultyError';
import { MailboxUnavailableError } from '../../../../../contexts/mailboxes/infrastructure/http/MailboxUnavailableError';
import { PigeonMailboxClient } from '../../../../../contexts/mailboxes/infrastructure/http/PigeonMailboxClient';
import { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';

describe(PigeonMailboxClient.name, () => {
  const mailboxId = 'mailbox-1';

  const setup = () => {
    const http = mock<HttpJsonClient>();

    return { client: new PigeonMailboxClient(http), http };
  };

  it('creates a mailbox with PUT carrying only hashes and the nonce', async () => {
    const { client, http } = setup();
    const creation = {
      creationNonce: '1',
      postTokenHash: 'p',
      readTokenHash: 'r',
    };

    http.request.mockResolvedValue(undefined);

    await client.create(mailboxId, creation);

    expect(http.request).toHaveBeenCalledWith('/mailboxes/mailbox-1', {
      body: JSON.stringify(creation),
      method: 'PUT',
    });
  });

  it('appends an envelope with POST authorised by the post token', async () => {
    const { client, http } = setup();

    http.request.mockResolvedValue({ cursor: 5 });

    await expect(
      client.append(mailboxId, 'post-token', { body: 'B', envelopeId: 'E' }),
    ).resolves.toEqual({ cursor: 5 });
    expect(http.request).toHaveBeenCalledWith(
      '/mailboxes/mailbox-1/envelopes',
      {
        body: JSON.stringify({ body: 'B', envelopeId: 'E' }),
        headers: { Authorization: 'Bearer post-token' },
        method: 'POST',
      },
    );
  });

  it('reads a page with GET authorised by the read token', async () => {
    const { client, http } = setup();

    http.request.mockResolvedValue({ envelopes: [], hasMore: false });

    await client.read(mailboxId, 'read-token', 3, 50);

    expect(http.request).toHaveBeenCalledWith(
      '/mailboxes/mailbox-1/envelopes?after=3&limit=50',
      { headers: { Authorization: 'Bearer read-token' } },
    );
  });

  it('acknowledges up to a cursor with POST authorised by the read token', async () => {
    const { client, http } = setup();

    http.request.mockResolvedValue(undefined);

    await client.acknowledge(mailboxId, 'read-token', 9);

    expect(http.request).toHaveBeenCalledWith('/mailboxes/mailbox-1/ack', {
      body: JSON.stringify({ upTo: 9 }),
      headers: { Authorization: 'Bearer read-token' },
      method: 'POST',
    });
  });

  it('maps a 404 on every route to MailboxUnavailableError', async () => {
    const { client, http } = setup();

    http.request.mockRejectedValue(new HttpJsonError(404, 'Not Found', ''));

    await expect(
      client.create(mailboxId, {
        creationNonce: '1',
        postTokenHash: 'p',
        readTokenHash: 'r',
      }),
    ).rejects.toBeInstanceOf(MailboxUnavailableError);
    await expect(
      client.append(mailboxId, 'post-token', { body: 'B', envelopeId: 'E' }),
    ).rejects.toBeInstanceOf(MailboxUnavailableError);
    await expect(
      client.read(mailboxId, 'read-token', 0, 10),
    ).rejects.toBeInstanceOf(MailboxUnavailableError);
    await expect(
      client.acknowledge(mailboxId, 'read-token', 1),
    ).rejects.toBeInstanceOf(MailboxUnavailableError);
  });

  it.each([400, 409, 429])(
    'propagates HTTP %i as HttpJsonError',
    async (status) => {
      const { client, http } = setup();

      http.request.mockRejectedValue(new HttpJsonError(status, 'x', ''));

      await expect(
        client.acknowledge(mailboxId, 'read-token', 1),
      ).rejects.toMatchObject({ status });
    },
  );

  it('reports a short creation proof with the difficulty the node requires', async () => {
    const { client, http } = setup();

    http.request.mockRejectedValue(
      new HttpJsonError(
        400,
        'Bad Request',
        JSON.stringify({
          code: 'BadRequestError',
          errors: [],
          httpStatus: 400,
          message: 'Mailbox creation proof does not meet the difficulty',
          requiredDifficultyBits: 17,
        }),
      ),
    );

    const rejection = client.create(mailboxId, {
      creationNonce: '1',
      postTokenHash: 'post-hash',
      readTokenHash: 'read-hash',
    });

    await expect(rejection).rejects.toBeInstanceOf(
      MailboxCreationDifficultyError,
    );
    await expect(rejection).rejects.toMatchObject({
      requiredDifficultyBits: 17,
    });
  });

  it.each([
    {},
    { requiredDifficultyBits: '17' },
    { requiredDifficultyBits: 0 },
    { requiredDifficultyBits: -1 },
    { requiredDifficultyBits: 16.5 },
  ])(
    'propagates a 400 without a usable requiredDifficultyBits (%j) as HttpJsonError',
    async (body) => {
      const { client, http } = setup();

      http.request.mockRejectedValue(
        new HttpJsonError(400, 'Bad Request', JSON.stringify(body)),
      );

      await expect(
        client.create(mailboxId, {
          creationNonce: '1',
          postTokenHash: 'post-hash',
          readTokenHash: 'read-hash',
        }),
      ).rejects.toBeInstanceOf(HttpJsonError);
    },
  );

  it('propagates a 400 with a non-JSON body as HttpJsonError', async () => {
    const { client, http } = setup();

    http.request.mockRejectedValue(
      new HttpJsonError(400, 'Bad Request', 'Bad Request'),
    );

    await expect(
      client.create(mailboxId, {
        creationNonce: '1',
        postTokenHash: 'post-hash',
        readTokenHash: 'read-hash',
      }),
    ).rejects.toBeInstanceOf(HttpJsonError);
  });

  it('lists the readers with GET authorised by a reader token', async () => {
    const { client, http } = setup();
    const readerSet = {
      maxReaders: 8,
      readers: [{ ackedCursor: 4, readTokenHash: 'hash-1' }],
    };

    http.request.mockResolvedValue(readerSet);

    await expect(client.readers(mailboxId, 'root-token')).resolves.toEqual(
      readerSet,
    );
    expect(http.request).toHaveBeenCalledWith('/mailboxes/mailbox-1/readers', {
      headers: { Authorization: 'Bearer root-token' },
    });
  });

  it('adds a reader with POST carrying only its hash, authorised by a reader token', async () => {
    const { client, http } = setup();

    http.request.mockResolvedValue(undefined);

    await client.addReader(mailboxId, 'root-token', 'device-hash');

    expect(http.request).toHaveBeenCalledWith('/mailboxes/mailbox-1/readers', {
      body: JSON.stringify({ readTokenHash: 'device-hash' }),
      headers: { Authorization: 'Bearer root-token' },
      method: 'POST',
    });
  });

  it('removes a reader by hash with DELETE, authorised by a reader token', async () => {
    const { client, http } = setup();

    http.request.mockResolvedValue(undefined);

    await client.removeReader(mailboxId, 'root-token', 'stale-hash');

    expect(http.request).toHaveBeenCalledWith(
      '/mailboxes/mailbox-1/readers/stale-hash',
      {
        headers: { Authorization: 'Bearer root-token' },
        method: 'DELETE',
      },
    );
  });

  it('maps a 404 on the reader routes to MailboxUnavailableError', async () => {
    const { client, http } = setup();

    http.request.mockRejectedValue(new HttpJsonError(404, 'Not Found', ''));

    await expect(client.readers(mailboxId, 'root-token')).rejects.toBeInstanceOf(
      MailboxUnavailableError,
    );
    await expect(
      client.addReader(mailboxId, 'root-token', 'device-hash'),
    ).rejects.toBeInstanceOf(MailboxUnavailableError);
    await expect(
      client.removeReader(mailboxId, 'root-token', 'stale-hash'),
    ).rejects.toBeInstanceOf(MailboxUnavailableError);
  });

  it('propagates a 409 when the reader set is full as HttpJsonError', async () => {
    const { client, http } = setup();

    http.request.mockRejectedValue(new HttpJsonError(409, 'Conflict', ''));

    await expect(
      client.addReader(mailboxId, 'root-token', 'device-hash'),
    ).rejects.toBeInstanceOf(HttpJsonError);
  });
});
