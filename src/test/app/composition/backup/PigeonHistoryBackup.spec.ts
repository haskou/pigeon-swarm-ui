import { HistoryBackupFile, SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { Buffer } from 'buffer';
import { mock } from 'jest-mock-extended';

import type { PigeonIdentitiesFacade } from '../../../../app/composition/identities/PigeonIdentitiesFacade';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { ContactPinStore } from '../../../../contexts/identities/infrastructure/storage/ContactPinStore';
import type { DirectMessageMailbox } from '../../../../contexts/messages/infrastructure/mailbox/DirectMessageMailbox';

import { HistoryBackupUnreadableError } from '../../../../app/composition/backup/HistoryBackupUnreadableError';
import { PigeonHistoryBackup } from '../../../../app/composition/backup/PigeonHistoryBackup';
import { DeviceUnlockNotConfirmedError } from '../../../../contexts/identities/infrastructure/storage/DeviceUnlockNotConfirmedError';
import { encodeBase64Url } from '../../../../shared/infrastructure/encoding/base64url';

describe(PigeonHistoryBackup.name, () => {
  const verifiedAt = '2026-05-01T00:00:00.000Z';
  const item = {
    conversationId: 'conversation-1',
    plaintext: new TextEncoder().encode('{"record":"m1"}'),
  };
  const rootOf = (seed: number): SymmetricKey =>
    SymmetricKey.fromBuffer(Buffer.alloc(32, seed));

  const session = (id = 'alice', root = 7): Session =>
    ({
      identity: { id },
      masterKey: rootOf(root),
    }) as unknown as Session;

  const fixture = () => {
    const identities = mock<PigeonIdentitiesFacade>();
    const directMessages = mock<DirectMessageMailbox>();
    const contactPins = mock<ContactPinStore>();

    identities.confirmLocalUnlock.mockResolvedValue(undefined);
    directMessages.exportHistory.mockResolvedValue([item]);
    directMessages.importHistory.mockResolvedValue(undefined);
    contactPins.load.mockReturnValue({
      'identity-x': { handle: 'bob', verifiedAt },
    });

    return {
      backup: new PigeonHistoryBackup(identities, directMessages, contactPins),
      contactPins,
      directMessages,
      identities,
    };
  };

  it('exports nothing until the person confirms the device unlock', async () => {
    const { backup, contactPins, directMessages, identities } = fixture();
    identities.confirmLocalUnlock.mockRejectedValue(
      new DeviceUnlockNotConfirmedError(),
    );

    await expect(
      backup.export(session(), 'wrong password'),
    ).rejects.toBeInstanceOf(DeviceUnlockNotConfirmedError);
    expect(identities.confirmLocalUnlock).toHaveBeenCalledWith(
      'alice',
      'wrong password',
    );
    expect(directMessages.exportHistory).not.toHaveBeenCalled();
    expect(contactPins.load).not.toHaveBeenCalled();
  });

  it('restores the exported history and contacts on the same identity', async () => {
    const { backup, contactPins, directMessages } = fixture();
    const alice = session();

    const file = await backup.export(alice, 'password');
    await backup.restore(alice, file);

    expect(file).not.toContain('bob');
    expect(file).not.toContain('conversation-1');
    expect(directMessages.importHistory).toHaveBeenCalledWith(alice, [item]);
    expect(contactPins.restore).toHaveBeenCalledWith('alice', {
      'identity-x': { handle: 'bob', verifiedAt },
    });
  });

  it('lets whoever holds the identity root read the exported history, with no key in the file', async () => {
    const { backup } = fixture();
    const file = await backup.export(session(), 'password');

    // Neither this device, its password nor its stored history is needed.
    const content = JSON.parse(
      new TextDecoder().decode(
        HistoryBackupFile.open(rootOf(7), 'alice', file),
      ),
    ) as Record<string, unknown>;

    expect(Object.keys(content).sort()).toEqual(['contacts', 'history']);
    expect(content.history).toEqual([
      {
        conversationId: item.conversationId,
        plaintext: encodeBase64Url(item.plaintext),
      },
    ]);
  });

  it('restores nothing from a backup made by another identity', async () => {
    const { backup, contactPins, directMessages } = fixture();
    const file = await backup.export(session('bob', 9), 'password');

    await expect(backup.restore(session(), file)).rejects.toBeInstanceOf(
      HistoryBackupUnreadableError,
    );
    expect(directMessages.importHistory).not.toHaveBeenCalled();
    expect(contactPins.restore).not.toHaveBeenCalled();
  });

  it('restores nothing from a tampered or previous-format file', async () => {
    const { backup, contactPins, directMessages } = fixture();
    const file = JSON.parse(await backup.export(session(), 'password')) as {
      ciphertext: string;
      version: number;
    };
    const first = file.ciphertext.startsWith('A') ? 'B' : 'A';
    const ciphertext = `${first}${file.ciphertext.slice(1)}`;

    await expect(
      backup.restore(session(), JSON.stringify({ ...file, ciphertext })),
    ).rejects.toBeInstanceOf(HistoryBackupUnreadableError);
    await expect(
      backup.restore(session(), JSON.stringify({ ...file, version: 0 })),
    ).rejects.toBeInstanceOf(HistoryBackupUnreadableError);
    expect(directMessages.importHistory).not.toHaveBeenCalled();
    expect(contactPins.restore).not.toHaveBeenCalled();
  });

  it('rejects an authentic file whose content is not a backup', async () => {
    const { backup, directMessages } = fixture();
    const file = HistoryBackupFile.seal(
      rootOf(7),
      'alice',
      new TextEncoder().encode('{"history":"nope"}'),
    );

    await expect(backup.restore(session(), file)).rejects.toBeInstanceOf(
      HistoryBackupUnreadableError,
    );
    expect(directMessages.importHistory).not.toHaveBeenCalled();
  });
});
