import type { MailboxKeys } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxKeySchedule';

import { MailboxUnavailableError } from '../../../../../contexts/mailboxes/infrastructure/http/MailboxUnavailableError';
import { RecipientMailboxRouter } from '../../../../../contexts/messages/infrastructure/mailbox/RecipientMailboxRouter';

describe(RecipientMailboxRouter.name, () => {
  const keys = {
    mailboxId: 'mailbox-1',
    postToken: 'post-token',
  } as MailboxKeys;
  const plaintext = new Uint8Array([1, 2, 3]);
  const appended = { cursor: 1, envelopeId: 'envelope-1' };

  function fixture(
    homeOf: (identityId: string) => Promise<string | undefined>,
  ) {
    const local = { send: jest.fn().mockResolvedValue(appended) };
    const foreign = { send: jest.fn().mockResolvedValue(appended) };
    const createChannel = jest.fn().mockReturnValue(foreign);
    const router = new RecipientMailboxRouter(local, homeOf, createChannel);

    return { createChannel, foreign, local, router };
  }

  it('appends to the verified mailbox home of the recipient', async () => {
    const { createChannel, foreign, local, router } = fixture(async () =>
      Promise.resolve('https://home.example'),
    );

    await router.send('bob', keys, plaintext);

    expect(createChannel).toHaveBeenCalledWith('https://home.example');
    expect(foreign.send).toHaveBeenCalledWith(keys, plaintext, undefined);
    expect(local.send).not.toHaveBeenCalled();
  });

  it('appends to the local node when no verified home is published', async () => {
    const { createChannel, local, router } = fixture(async () =>
      Promise.resolve(undefined),
    );

    await router.send('bob', keys, plaintext);

    expect(createChannel).not.toHaveBeenCalled();
    expect(local.send).toHaveBeenCalledWith(keys, plaintext, undefined);
  });

  it('falls back to the local node when the foreign append fails', async () => {
    const { foreign, local, router } = fixture(async () =>
      Promise.resolve('https://home.example'),
    );

    foreign.send.mockRejectedValueOnce(new Error('unreachable'));

    await router.send('bob', keys, plaintext);

    expect(local.send).toHaveBeenCalledWith(keys, plaintext, undefined);
  });

  it('falls back to the local node when the home lookup fails', async () => {
    const { local, router } = fixture(async () =>
      Promise.reject(new Error('lookup failed')),
    );

    await router.send('bob', keys, plaintext);

    expect(local.send).toHaveBeenCalledWith(keys, plaintext, undefined);
  });

  it('appends to a path-prefixed verified base unchanged', async () => {
    const { createChannel, foreign, router } = fixture(async () =>
      Promise.resolve('https://home.example/api'),
    );

    await router.send('bob', keys, plaintext);

    expect(createChannel).toHaveBeenCalledWith('https://home.example/api');
    expect(foreign.send).toHaveBeenCalledWith(keys, plaintext, undefined);
  });

  it('logs one count-only line when the foreign append fails', async () => {
    const debug = jest
      .spyOn(console, 'debug')
      .mockImplementation(() => undefined);
    const { foreign, local, router } = fixture(async () =>
      Promise.resolve('https://home.example/api'),
    );

    foreign.send.mockRejectedValueOnce(new Error('404 /api/mailboxes/secret'));

    await router.send('bob', keys, plaintext);

    expect(local.send).toHaveBeenCalledWith(keys, plaintext, undefined);
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

    await router.send('bob', keys, plaintext);

    expect(local.send).toHaveBeenCalledWith(keys, plaintext, undefined);
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

    await expect(router.send('bob', keys, plaintext)).rejects.toThrow(
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

    await expect(router.send('bob', keys, plaintext)).rejects.toThrow(
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

    await expect(router.send('bob', keys, plaintext)).rejects.toBeInstanceOf(
      MailboxUnavailableError,
    );
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

    await expect(router.send('bob', keys, plaintext)).resolves.toBe(appended);
    expect(local.send).toHaveBeenCalledWith(keys, plaintext, undefined);
    debug.mockRestore();
  });

  it('forwards the envelope id to the verified mailbox home', async () => {
    const { foreign, router } = fixture(async () =>
      Promise.resolve('https://home.example'),
    );

    await router.send('bob', keys, plaintext, 'envelope-7');

    expect(foreign.send).toHaveBeenCalledWith(keys, plaintext, 'envelope-7');
  });

  it('forwards the envelope id to the local node when no home is published', async () => {
    const { local, router } = fixture(async () => Promise.resolve(undefined));

    await router.send('bob', keys, plaintext, 'envelope-7');

    expect(local.send).toHaveBeenCalledWith(keys, plaintext, 'envelope-7');
  });
});
