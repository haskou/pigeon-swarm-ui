import { Buffer } from 'buffer';
import { mock } from 'jest-mock-extended';

import { MailboxCapability } from '../../../../contexts/mailboxes/infrastructure/crypto/MailboxCapability';
import { MailboxCreationProof } from '../../../../contexts/mailboxes/infrastructure/crypto/MailboxCreationProof';
import { MailboxEnvelopeCipher } from '../../../../contexts/mailboxes/infrastructure/crypto/MailboxEnvelopeCipher';
import { MailboxKeySchedule } from '../../../../contexts/mailboxes/infrastructure/crypto/MailboxKeySchedule';
import { PigeonMailboxClient } from '../../../../contexts/mailboxes/infrastructure/http/PigeonMailboxClient';
import { MailboxChannel } from '../../../../contexts/mailboxes/infrastructure/MailboxChannel';

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
      (mailboxId: string, postTokenHash: string, readTokenHash: string) =>
        Promise.resolve(
          MailboxCreationProof.mine(mailboxId, postTokenHash, readTokenHash),
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

    await channel.acknowledge(keys.mailboxId, readToken, 3);

    expect(client.acknowledge).toHaveBeenCalledWith(
      keys.mailboxId,
      readToken,
      3,
    );
  });
});
