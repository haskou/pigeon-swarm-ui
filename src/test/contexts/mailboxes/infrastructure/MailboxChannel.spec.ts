import { Buffer } from 'buffer';
import { mock } from 'jest-mock-extended';

import { MailboxCapability } from '../../../../contexts/mailboxes/infrastructure/crypto/MailboxCapability';
import { MailboxCreationProof } from '../../../../contexts/mailboxes/infrastructure/crypto/MailboxCreationProof';
import { MailboxEnvelopeCipher } from '../../../../contexts/mailboxes/infrastructure/crypto/MailboxEnvelopeCipher';
import { MailboxKeySchedule } from '../../../../contexts/mailboxes/infrastructure/crypto/MailboxKeySchedule';
import { MailboxCreationDifficultyError } from '../../../../contexts/mailboxes/infrastructure/http/MailboxCreationDifficultyError';
import { MailboxUnavailableError } from '../../../../contexts/mailboxes/infrastructure/http/MailboxUnavailableError';
import { PigeonMailboxClient } from '../../../../contexts/mailboxes/infrastructure/http/PigeonMailboxClient';
import { MailboxChannel } from '../../../../contexts/mailboxes/infrastructure/MailboxChannel';
import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';

describe(MailboxChannel.name, () => {
  const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);
  const readToken = 'read-token-for-bob';
  const keys = MailboxKeySchedule.derive(
    new Uint8Array(32).fill(3),
    'identity-bob',
    0,
  );

  const setup = () => {
    const client = mock<PigeonMailboxClient>();
    const mine = jest.fn(
      (
        mailboxId: string,
        postTokenHash: string,
        readTokenHash: string,
        difficultyBits: number,
      ) =>
        Promise.resolve(
          MailboxCreationProof.mine(
            mailboxId,
            postTokenHash,
            readTokenHash,
            difficultyBits,
          ),
        ),
    );

    return { channel: new MailboxChannel(client, mine), client };
  };

  it('creates the inbox with capability hashes and a valid creation proof', async () => {
    const { channel, client } = setup();

    await channel.createInbox(keys, readToken);

    const postTokenHash = MailboxCapability.hash(keys.postToken);
    const readTokenHash = MailboxCapability.hash(readToken);

    expect(client.create).toHaveBeenCalledWith(keys.mailboxId, {
      creationNonce: expect.any(String),
      postTokenHash,
      readTokenHash,
    });

    const creationNonce = client.create.mock.calls[0][1].creationNonce;

    expect(
      MailboxCreationProof.isValid(
        keys.mailboxId,
        postTokenHash,
        readTokenHash,
        creationNonce,
      ),
    ).toBe(true);
  });

  it('seals plaintext into a bucket-sized envelope posted with the post token', async () => {
    const { channel, client } = setup();

    client.append.mockResolvedValue({ cursor: 1 });

    const sent = await channel.send(keys, bytes('hi bob'));

    expect(sent.envelopeId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(sent.cursor).toBe(1);

    const envelope = client.append.mock.calls[0][2];

    expect(client.append).toHaveBeenCalledWith(keys.mailboxId, keys.postToken, {
      body: expect.any(String),
      envelopeId: sent.envelopeId,
    });
    expect(Buffer.from(envelope.body, 'base64url').length).toBe(1024);
    expect(
      Buffer.from(
        MailboxEnvelopeCipher.open(
          keys.envelopeKey,
          keys.mailboxId,
          envelope.envelopeId,
          envelope.body,
        ),
      ).toString('utf8'),
    ).toBe('hi bob');
  });

  it('opens authentic envelopes, drops forged ones, and reports the highest cursor', async () => {
    const { channel, client } = setup();

    client.append
      .mockResolvedValueOnce({ cursor: 1 })
      .mockResolvedValueOnce({ cursor: 2 });

    const first = await channel.send(keys, bytes('one'));
    const second = await channel.send(keys, bytes('two'));
    const forgedEnvelopeId = 'AAAAAAAAAAAAAAAAAAAAAA';
    const forged = MailboxEnvelopeCipher.seal(
      new Uint8Array(32).fill(9),
      keys.mailboxId,
      forgedEnvelopeId,
      bytes('forged'),
    );

    client.read.mockResolvedValue({
      envelopes: [
        {
          body: client.append.mock.calls[0][2].body,
          cursor: 1,
          envelopeId: first.envelopeId,
        },
        { body: forged, cursor: 2, envelopeId: forgedEnvelopeId },
        {
          body: client.append.mock.calls[1][2].body,
          cursor: 3,
          envelopeId: second.envelopeId,
        },
      ],
      hasMore: true,
    });

    const page = await channel.read(keys, readToken, 0, 3);

    expect(client.read).toHaveBeenCalledWith(keys.mailboxId, readToken, 0, 3);
    expect(
      page.envelopes.map((envelope) => [
        envelope.cursor,
        Buffer.from(envelope.plaintext).toString('utf8'),
      ]),
    ).toEqual([
      [1, 'one'],
      [3, 'two'],
    ]);
    expect(page.hasMore).toBe(true);
    expect(page.lastCursor).toBe(3);
  });

  it('keeps the requested cursor when the page is empty', async () => {
    const { channel, client } = setup();

    client.read.mockResolvedValue({ envelopes: [], hasMore: false });

    await expect(channel.read(keys, readToken, 7, 10)).resolves.toEqual({
      envelopes: [],
      hasMore: false,
      lastCursor: 7,
    });
  });

  it('acknowledges a cursor with the read token', async () => {
    const { channel, client } = setup();

    await channel.acknowledge(keys, readToken, 3);

    expect(client.acknowledge).toHaveBeenCalledWith(
      keys.mailboxId,
      readToken,
      3,
    );
  });

  describe('creation difficulty', () => {
    const postTokenHash = MailboxCapability.hash(keys.postToken);
    const readTokenHash = MailboxCapability.hash(readToken);

    it('re-mines at the difficulty the node requires and retries the PUT once', async () => {
      const { channel, client, mine } = setup();

      client.create
        .mockRejectedValueOnce(new MailboxCreationDifficultyError(17))
        .mockResolvedValueOnce(undefined);

      await channel.createInbox(keys, readToken);

      expect(mine).toHaveBeenNthCalledWith(
        1,
        keys.mailboxId,
        postTokenHash,
        readTokenHash,
        16,
      );
      expect(mine).toHaveBeenNthCalledWith(
        2,
        keys.mailboxId,
        postTokenHash,
        readTokenHash,
        17,
      );
      expect(client.create).toHaveBeenCalledTimes(2);

      const retriedNonce = client.create.mock.calls[1][1].creationNonce;

      expect(
        MailboxCreationProof.isValid(
          keys.mailboxId,
          postTokenHash,
          readTokenHash,
          retriedNonce,
          17,
        ),
      ).toBe(true);
    });

    it.each([16, 25])(
      'propagates a requirement of %i bits without re-mining',
      async (requiredDifficultyBits) => {
        const { channel, client, mine } = setup();

        client.create.mockRejectedValueOnce(
          new MailboxCreationDifficultyError(requiredDifficultyBits),
        );

        await expect(
          channel.createInbox(keys, readToken),
        ).rejects.toBeInstanceOf(MailboxCreationDifficultyError);
        expect(mine).toHaveBeenCalledTimes(1);
        expect(client.create).toHaveBeenCalledTimes(1);
      },
    );

    it('gives up after one re-mined retry', async () => {
      const { channel, client, mine } = setup();

      client.create.mockRejectedValue(new MailboxCreationDifficultyError(17));

      await expect(channel.createInbox(keys, readToken)).rejects.toBeInstanceOf(
        MailboxCreationDifficultyError,
      );
      expect(mine).toHaveBeenCalledTimes(2);
      expect(client.create).toHaveBeenCalledTimes(2);
    });

    it('propagates other creation failures without re-mining', async () => {
      const { channel, client, mine } = setup();

      client.create.mockRejectedValueOnce(
        new HttpJsonError(400, 'Bad Request', '{}'),
      );

      await expect(channel.createInbox(keys, readToken)).rejects.toBeInstanceOf(
        HttpJsonError,
      );
      expect(mine).toHaveBeenCalledTimes(1);
    });
  });

  describe('recovering an evicted mailbox', () => {
    const postTokenHash = MailboxCapability.hash(keys.postToken);
    const readTokenHash = MailboxCapability.hash(readToken);

    it('re-creates the mailbox with the same hashes and retries the read once', async () => {
      const { channel, client } = setup();

      client.read
        .mockRejectedValueOnce(new MailboxUnavailableError())
        .mockResolvedValueOnce({ envelopes: [], hasMore: false });

      await expect(channel.read(keys, readToken, 7, 10)).resolves.toEqual({
        envelopes: [],
        hasMore: false,
        lastCursor: 7,
      });
      expect(client.create).toHaveBeenCalledTimes(1);
      expect(client.create).toHaveBeenCalledWith(keys.mailboxId, {
        creationNonce: expect.any(String),
        postTokenHash,
        readTokenHash,
      });
      expect(client.read).toHaveBeenCalledTimes(2);
      expect(client.create.mock.invocationCallOrder[0]).toBeLessThan(
        client.read.mock.invocationCallOrder[1],
      );
    });

    it('gives up after one re-creation when the read is still unavailable', async () => {
      const { channel, client } = setup();

      client.read.mockRejectedValue(new MailboxUnavailableError());

      await expect(channel.read(keys, readToken, 0, 10)).rejects.toBeInstanceOf(
        MailboxUnavailableError,
      );
      expect(client.create).toHaveBeenCalledTimes(1);
      expect(client.read).toHaveBeenCalledTimes(2);
    });

    it('re-creates the mailbox before retrying an acknowledgement', async () => {
      const { channel, client } = setup();

      client.acknowledge
        .mockRejectedValueOnce(new MailboxUnavailableError())
        .mockResolvedValueOnce(undefined);

      await channel.acknowledge(keys, readToken, 3);

      expect(client.create).toHaveBeenCalledTimes(1);
      expect(client.acknowledge).toHaveBeenCalledTimes(2);
      expect(client.acknowledge).toHaveBeenLastCalledWith(
        keys.mailboxId,
        readToken,
        3,
      );
    });

    it('does not re-create the mailbox when a sender append is unavailable', async () => {
      const { channel, client } = setup();

      client.append.mockRejectedValueOnce(new MailboxUnavailableError());

      await expect(channel.send(keys, bytes('hi bob'))).rejects.toBeInstanceOf(
        MailboxUnavailableError,
      );
      expect(client.create).not.toHaveBeenCalled();
    });
  });
});
