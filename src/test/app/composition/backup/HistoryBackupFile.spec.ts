import { Buffer } from 'buffer';

import { HistoryBackupFile } from '../../../../app/composition/backup/HistoryBackupFile';
import { HistoryBackupUnreadableError } from '../../../../app/composition/backup/HistoryBackupUnreadableError';
import { HistoryBackupVersionError } from '../../../../app/composition/backup/HistoryBackupVersionError';
import { encodeBase64Url } from '../../../../shared/infrastructure/encoding/base64url';

type SealedFile = Record<string, unknown>;

describe(HistoryBackupFile.name, () => {
  const root = Buffer.alloc(32, 7);
  const plaintext = new TextEncoder().encode('{"secret":"history"}');

  const sealed = () => HistoryBackupFile.seal(root, 'alice', plaintext);
  const edited = (file: string, change: (parsed: SealedFile) => void) => {
    const parsed = JSON.parse(file) as SealedFile;

    change(parsed);

    return JSON.stringify(parsed);
  };

  it('opens a file sealed for the same identity root', async () => {
    const file = await sealed();

    await expect(HistoryBackupFile.open(root, 'alice', file)).resolves.toEqual(
      plaintext,
    );
  });

  it('never writes the history in the clear', async () => {
    const file = await sealed();

    expect(file).not.toContain('secret');
    expect(file).not.toContain('history"');
    expect(file).not.toContain('alice');
  });

  it('rejects a file opened with another root, as after a wrong account', async () => {
    const file = await sealed();

    await expect(
      HistoryBackupFile.open(Buffer.alloc(32, 8), 'alice', file),
    ).rejects.toBeInstanceOf(HistoryBackupUnreadableError);
    await expect(
      HistoryBackupFile.open(root, 'bob', file),
    ).rejects.toBeInstanceOf(HistoryBackupUnreadableError);
  });

  it('rejects a file whose ciphertext was tampered with', async () => {
    const file = await sealed();
    const tampered = edited(file, (parsed) => {
      const bytes = Buffer.from(
        String(parsed.ciphertext).replace(/-/g, '+').replace(/_/g, '/'),
        'base64',
      );

      bytes[0] = bytes[0] === 0 ? 1 : 0;
      parsed.ciphertext = encodeBase64Url(bytes);
    });

    await expect(
      HistoryBackupFile.open(root, 'alice', tampered),
    ).rejects.toBeInstanceOf(HistoryBackupUnreadableError);
  });

  it('rejects a file whose nonce was replaced', async () => {
    const file = await sealed();
    const tampered = edited(file, (parsed) => {
      parsed.iv = encodeBase64Url(Buffer.alloc(12, 1));
    });

    await expect(
      HistoryBackupFile.open(root, 'alice', tampered),
    ).rejects.toBeInstanceOf(HistoryBackupUnreadableError);
  });

  it('rejects a file that is not a backup', async () => {
    await expect(
      HistoryBackupFile.open(root, 'alice', 'not json'),
    ).rejects.toBeInstanceOf(HistoryBackupUnreadableError);
    await expect(
      HistoryBackupFile.open(root, 'alice', '{"format":"other","version":1}'),
    ).rejects.toBeInstanceOf(HistoryBackupUnreadableError);
    await expect(
      HistoryBackupFile.open(root, 'alice', '[]'),
    ).rejects.toBeInstanceOf(HistoryBackupUnreadableError);
  });

  it('rejects a previous or unknown format version instead of reading it', async () => {
    const file = await sealed();

    for (const version of [0, 2, '1']) {
      await expect(
        HistoryBackupFile.open(
          root,
          'alice',
          edited(file, (parsed) => {
            parsed.version = version;
          }),
        ),
      ).rejects.toBeInstanceOf(HistoryBackupVersionError);
    }
  });

  it('seals each file under a fresh nonce', async () => {
    const first = JSON.parse(await sealed()) as SealedFile;
    const second = JSON.parse(await sealed()) as SealedFile;

    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });
});
