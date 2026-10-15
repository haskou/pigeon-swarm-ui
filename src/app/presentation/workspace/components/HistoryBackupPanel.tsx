import { type ChangeEvent, useRef, useState } from 'react';

import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { historyBackup } from '../../../composition/applicationContainer';
import { ProfileInput } from './ProfileInput';

type BackupStatus =
  | { kind: 'busy'; message: string }
  | { kind: 'done'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'idle' };

const passwordPlaceholder = '••••••••••••';

function downloadBackup(file: string): void {
  const url = URL.createObjectURL(
    new Blob([file], { type: 'application/json' }),
  );
  const link = document.createElement('a');

  link.href = url;
  link.download = `pigeon-swarm-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function BackupStatusLine({ status }: { status: BackupStatus }) {
  if (status.kind === 'idle') return null;

  if (status.kind === 'error') {
    return (
      <div
        className="ui-inline-notice border-rose-300/50 bg-rose-500/10 text-rose-100"
        role="alert"
      >
        {status.message}
      </div>
    );
  }

  return (
    <p className="text-xs font-semibold text-white/60" role="status">
      {status.message}
    </p>
  );
}

/**
 * Exports this identity's direct history and contacts as one encrypted file
 * after the device password confirms the person, and restores such a file.
 * The file never holds private or session keys.
 */
export function HistoryBackupPanel({ session }: { session: Session }) {
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<BackupStatus>({ kind: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = status.kind === 'busy';

  const run = async (
    working: string,
    done: string,
    fallback: string,
    action: () => Promise<void>,
  ) => {
    setStatus({ kind: 'busy', message: working });

    try {
      await action();
      setStatus({ kind: 'done', message: done });
    } catch (caught) {
      setStatus({
        kind: 'error',
        message: toUserErrorMessage(caught, fallback),
      });
    }
  };

  const backUp = () =>
    run(
      copy.deviceStorage.backingUp,
      copy.deviceStorage.backupDone,
      copy.deviceStorage.backupFailed,
      async () => {
        const secret = password;

        setPassword('');
        downloadBackup(await historyBackup.export(session, secret));
      },
    );

  const restore = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (fileInputRef.current) fileInputRef.current.value = '';

    if (!file) return;

    await run(
      copy.deviceStorage.restoring,
      copy.deviceStorage.restored,
      copy.deviceStorage.restoreFailed,
      async () => historyBackup.restore(session, await file.text()),
    );
  };

  return (
    <div className="mt-4 grid gap-3" data-testid="history-backup">
      <div>
        <h4 className="mb-1 text-xs font-black uppercase tracking-[0.16em] text-white/35">
          {copy.deviceStorage.backupTitle}
        </h4>
        <p className="text-xs font-semibold leading-relaxed text-white/60">
          {copy.deviceStorage.backupBody}
        </p>
      </div>
      <ProfileInput
        label={copy.deviceStorage.backupPassword}
        value={password}
        onChange={setPassword}
        placeholder={passwordPlaceholder}
        type="password"
      />
      <button
        className="ui-button ui-button-primary w-full"
        data-testid="history-backup-export"
        disabled={busy || !password}
        onClick={() => void backUp()}
        type="button"
      >
        {copy.deviceStorage.backup}
      </button>
      <button
        className="ui-button w-full"
        data-testid="history-backup-restore"
        disabled={busy}
        onClick={() => fileInputRef.current?.click()}
        type="button"
      >
        {copy.deviceStorage.restore}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={(event) => void restore(event)}
        className="sr-only"
        data-testid="history-backup-file"
      />
      <BackupStatusLine status={status} />
    </div>
  );
}
