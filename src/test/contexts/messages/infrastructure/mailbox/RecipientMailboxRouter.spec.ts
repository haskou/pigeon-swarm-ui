import type { MailboxKeys } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxKeySchedule';

import { MailboxUnavailableError } from '../../../../../contexts/mailboxes/domain/errors/MailboxUnavailableError';
import { RecipientMailboxRouter } from '../../../../../contexts/messages/infrastructure/mailbox/RecipientMailboxRouter';

describe(RecipientMailboxRouter.name, () => {
  const keys = {
    mailboxId: 'mailbox-1',
    postToken: 'post-token',
  } as MailboxKeys;
  const plaintext = new Uint8Array([1, 2, 3]);
  const appended = { cursor: 1, envelopeId: 'envelope-1' };
  const anyEnvelopeId = expect.any(String) as unknown as string;

  function fixture(
    homeOf: (identityId: string) => Promise<string | undefined>,
  ) {
    const local = { send: jest.fn().mockResolvedValue(appended) };
    const foreign = { send: jest.fn().mockResolvedValue(appended) };
    const createChannel = jest.fn().mockReturnValue(foreign);
    const router = new RecipientMailboxRouter(local, homeOf, createChannel);

    return { createChannel, foreign, local, router };
  }

  /** Each availability server gets its own channel double. */
  function fanOutFixture(
    homeOf: (identityId: string) => Promise<string | undefined>,
  ) {
    const local = { send: jest.fn().mockResolvedValue(appended) };
    const channels = new Map<string, { send: jest.Mock }>();
    const channelFor = (base: string) => {
      const channel = channels.get(base) ?? {
        send: jest.fn().mockResolvedValue({ cursor: 9, envelopeId: base }),
      };

      channels.set(base, channel);

      return channel;
    };
    const router = new RecipientMailboxRouter(local, homeOf, channelFor);

    return { channelFor, local, router };
  }

  it('appends to the verified mailbox home of the recipient', async () => {
    const { createChannel, foreign, local, router } = fixture(async () =>
      Promise.resolve('https://home.example'),
    );

    await router.send('bob', [], keys, plaintext);

    expect(createChannel).toHaveBeenCalledWith('https://home.example');
    expect(foreign.send).toHaveBeenCalledWith(keys, plaintext, anyEnvelopeId);
    expect(local.send).not.toHaveBeenCalled();
  });

  it('appends to the local node when no verified home is published', async () => {
    const { createChannel, local, router } = fixture(async () =>
      Promise.resolve(undefined),
    );

    await router.send('bob', [], keys, plaintext);

    expect(createChannel).not.toHaveBeenCalled();
    expect(local.send).toHaveBeenCalledWith(keys, plaintext, anyEnvelopeId);
  });

  it('falls back to the local node when the foreign append fails', async () => {
    const { foreign, local, router } = fixture(async () =>
      Promise.resolve('https://home.example'),
    );

    foreign.send.mockRejectedValueOnce(new Error('unreachable'));

    await router.send('bob', [], keys, plaintext);

    expect(local.send).toHaveBeenCalledWith(keys, plaintext, anyEnvelopeId);
  });

  it('falls back to the local node when the home lookup fails', async () => {
    const { local, router } = fixture(async () =>
      Promise.reject(new Error('lookup failed')),
    );

    await router.send('bob', [], keys, plaintext);

    expect(local.send).toHaveBeenCalledWith(keys, plaintext, anyEnvelopeId);
  });

  it('appends to a path-prefixed verified base unchanged', async () => {
    const { createChannel, foreign, router } = fixture(async () =>
      Promise.resolve('https://home.example/api'),
    );

    await router.send('bob', [], keys, plaintext);

    expect(createChannel).toHaveBeenCalledWith('https://home.example/api');
    expect(foreign.send).toHaveBeenCalledWith(keys, plaintext, anyEnvelopeId);
  });

  it('logs one count-only line when the foreign append fails', async () => {
    const debug = jest
      .spyOn(console, 'debug')
      .mockImplementation(() => undefined);
    const { foreign, local, router } = fixture(async () =>
      Promise.resolve('https://home.example/api'),
    );

    foreign.send.mockRejectedValueOnce(new Error('404 /api/mailboxes/secret'));

    await router.send('bob', [], keys, plaintext);

    expect(local.send).toHaveBeenCalledWith(keys, plaintext, anyEnvelopeId);
    expect(debug).toHaveBeenCalledTimes(1);
    expect(debug).toHaveBeenCalledWith(
      'Recipient mailbox append failed; local node used.',
    );
    debug.mockRestore();
  });

  it('logs one count-only line when the home lookup fails', async () => {
    const debug = jest
      .spyOn(console, 'debug')
      .mockImplementation(() => undefined);
    const { local, router } = fixture(async () =>
      Promise.reject(new Error('lookup failed')),
    );

    await router.send('bob', [], keys, plaintext);

    expect(local.send).toHaveBeenCalledWith(keys, plaintext, anyEnvelopeId);
    expect(debug).toHaveBeenCalledWith(
      'Recipient mailbox home lookup failed; local node used.',
    );
    debug.mockRestore();
  });

  it('rethrows the foreign append fault when the local node has no inbox', async () => {
    const debug = jest
      .spyOn(console, 'debug')
      .mockImplementation(() => undefined);
    const { foreign, local, router } = fixture(async () =>
      Promise.resolve('https://home.example'),
    );

    foreign.send.mockRejectedValueOnce(new Error('socket hang up'));
    local.send.mockRejectedValueOnce(new MailboxUnavailableError());

    await expect(router.send('bob', [], keys, plaintext)).rejects.toThrow(
      'socket hang up',
    );
    debug.mockRestore();
  });

  it('rethrows the home lookup fault when the local node has no inbox', async () => {
    const debug = jest
      .spyOn(console, 'debug')
      .mockImplementation(() => undefined);
    const { local, router } = fixture(async () =>
      Promise.reject(new Error('lookup failed')),
    );

    local.send.mockRejectedValueOnce(new MailboxUnavailableError());

    await expect(router.send('bob', [], keys, plaintext)).rejects.toThrow(
      'lookup failed',
    );
    debug.mockRestore();
  });

  it('keeps a no-inbox error when the home and the local node both have no inbox', async () => {
    const debug = jest
      .spyOn(console, 'debug')
      .mockImplementation(() => undefined);
    const { foreign, local, router } = fixture(async () =>
      Promise.resolve('https://home.example'),
    );

    foreign.send.mockRejectedValueOnce(new MailboxUnavailableError());
    local.send.mockRejectedValueOnce(new MailboxUnavailableError());

    await expect(
      router.send('bob', [], keys, plaintext),
    ).rejects.toBeInstanceOf(MailboxUnavailableError);
    debug.mockRestore();
  });

  it('delivers through the local node after a foreign network fault', async () => {
    const debug = jest
      .spyOn(console, 'debug')
      .mockImplementation(() => undefined);
    const { foreign, local, router } = fixture(async () =>
      Promise.resolve('https://home.example'),
    );

    foreign.send.mockRejectedValueOnce(new Error('socket hang up'));

    await expect(router.send('bob', [], keys, plaintext)).resolves.toBe(
      appended,
    );
    expect(local.send).toHaveBeenCalledWith(keys, plaintext, anyEnvelopeId);
    debug.mockRestore();
  });

  it('forwards the envelope id to the verified mailbox home', async () => {
    const { foreign, router } = fixture(async () =>
      Promise.resolve('https://home.example'),
    );

    await router.send('bob', [], keys, plaintext, 'envelope-7');

    expect(foreign.send).toHaveBeenCalledWith(keys, plaintext, 'envelope-7');
  });

  it('forwards the envelope id to the local node when no home is published', async () => {
    const { local, router } = fixture(async () => Promise.resolve(undefined));

    await router.send('bob', [], keys, plaintext, 'envelope-7');

    expect(local.send).toHaveBeenCalledWith(keys, plaintext, 'envelope-7');
  });

  describe('availability servers', () => {
    const servers = ['https://a.example', 'https://b.example'];

    it('appends the same envelope to the home and to every availability server', async () => {
      const { channelFor, local, router } = fanOutFixture(async () =>
        Promise.resolve(undefined),
      );

      await router.send('bob', servers, keys, plaintext, 'envelope-7');

      expect(local.send).toHaveBeenCalledWith(keys, plaintext, 'envelope-7');
      for (const base of servers) {
        expect(channelFor(base).send).toHaveBeenCalledWith(
          keys,
          plaintext,
          'envelope-7',
        );
      }
    });

    it('pins one fresh envelope id across every server when none is given', async () => {
      const { channelFor, local, router } = fanOutFixture(async () =>
        Promise.resolve(undefined),
      );

      await router.send('bob', servers, keys, plaintext);

      const [localId] = local.send.mock.calls[0].slice(2) as [string];
      expect(localId).toEqual(expect.any(String));
      for (const base of servers) {
        expect(channelFor(base).send).toHaveBeenCalledWith(
          keys,
          plaintext,
          localId,
        );
      }
    });

    it('resolves the primary append when it lands', async () => {
      const { router } = fanOutFixture(async () => Promise.resolve(undefined));

      await expect(router.send('bob', servers, keys, plaintext)).resolves.toBe(
        appended,
      );
    });

    it('delivers when only an availability server takes the envelope', async () => {
      const debug = jest
        .spyOn(console, 'debug')
        .mockImplementation(() => undefined);
      const { channelFor, local, router } = fanOutFixture(async () =>
        Promise.resolve(undefined),
      );

      local.send.mockRejectedValueOnce(new Error('socket hang up'));
      channelFor(servers[0]).send.mockRejectedValueOnce(
        new MailboxUnavailableError(),
      );

      await expect(
        router.send('bob', servers, keys, plaintext),
      ).resolves.toEqual({ cursor: 9, envelopeId: servers[1] });
      debug.mockRestore();
    });

    it('rethrows the primary error when no server takes the envelope', async () => {
      const debug = jest
        .spyOn(console, 'debug')
        .mockImplementation(() => undefined);
      const { channelFor, local, router } = fanOutFixture(async () =>
        Promise.resolve(undefined),
      );

      local.send.mockRejectedValueOnce(new MailboxUnavailableError());
      for (const base of servers) {
        channelFor(base).send.mockRejectedValueOnce(new Error('offline'));
      }

      await expect(
        router.send('bob', servers, keys, plaintext),
      ).rejects.toBeInstanceOf(MailboxUnavailableError);
      debug.mockRestore();
    });

    it('logs one count-only line per failed availability server', async () => {
      const debug = jest
        .spyOn(console, 'debug')
        .mockImplementation(() => undefined);
      const { channelFor, router } = fanOutFixture(async () =>
        Promise.resolve(undefined),
      );

      for (const base of servers) {
        channelFor(base).send.mockRejectedValueOnce(
          new Error(`offline ${base}`),
        );
      }

      await router.send('bob', servers, keys, plaintext);

      expect(debug.mock.calls).toEqual([
        ['Availability mailbox append failed.'],
        ['Availability mailbox append failed.'],
      ]);
      debug.mockRestore();
    });
  });
});
