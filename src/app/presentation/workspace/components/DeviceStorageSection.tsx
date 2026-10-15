import { useEffect, useState } from 'react';

import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { DeviceStorageEstimate } from '../../../../shared/infrastructure/storage/DeviceStorageEstimate';

import { cx } from '../../../../shared/presentation/cx';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { deviceStorage } from '../../../composition/applicationContainer';
import { HistoryBackupPanel } from './HistoryBackupPanel';

const GIB = 1024 * 1024 * 1024;

function formatStorageSize(bytes: number): string {
  const gigabytes = bytes >= GIB;

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
    style: 'unit',
    unit: gigabytes ? 'gigabyte' : 'megabyte',
    unitDisplay: 'short',
  }).format(gigabytes ? bytes / GIB : bytes / (1024 * 1024));
}

function StorageUsage({ estimate }: { estimate: DeviceStorageEstimate }) {
  return (
    <div className="space-y-1 text-xs font-semibold leading-relaxed">
      <p className="text-white/80">
        {copy.deviceStorage.usage
          .replace('{usage}', formatStorageSize(estimate.usage))
          .replace('{quota}', formatStorageSize(estimate.quota))}
      </p>
      <p className={estimate.persisted ? 'text-white/45' : 'text-amber-200/70'}>
        {estimate.persisted
          ? copy.deviceStorage.protected
          : copy.deviceStorage.notProtected}
      </p>
      {estimate.low && (
        <p className="text-amber-200/70">{copy.deviceStorage.low}</p>
      )}
    </div>
  );
}

function StoragePlace({ body, title }: { body: string; title: string }) {
  return (
    <div className="mt-4">
      <h4 className="mb-1 text-xs font-black uppercase tracking-[0.16em] text-white/35">
        {title}
      </h4>
      <p className="text-xs font-semibold leading-relaxed text-white/60">
        {body}
      </p>
    </div>
  );
}

/**
 * Where messages are kept: on this device, on the server, and with other
 * people. Reads the browser's storage estimate only while open, and offers an
 * encrypted backup of this identity's direct history and contacts.
 */
export function DeviceStorageSection({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  const [estimate, setEstimate] = useState<
    DeviceStorageEstimate | null | undefined
  >(undefined);

  useEffect(() => {
    if (!open) return undefined;

    let live = true;

    void deviceStorage.estimate().then((next) => {
      if (live) setEstimate(next);
    });

    return () => {
      live = false;
    };
  }, [open]);

  return (
    <section className="ui-section">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-black text-white/75 transition hover:bg-white/5"
        aria-controls="device-storage-panel"
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="block">{copy.deviceStorage.title}</span>
          <span className="mt-1 block text-xs font-bold text-white/40">
            {copy.deviceStorage.help}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={cx(
            'text-white/45 transition-transform',
            open && 'rotate-180',
          )}
        >
          ⌄
        </span>
      </button>
      {open && (
        <div
          className="border-t border-white/[0.06] px-4 pb-5 pt-4"
          id="device-storage-panel"
        >
          {estimate && <StorageUsage estimate={estimate} />}
          {estimate === null && (
            <p className="text-xs font-semibold text-white/45">
              {copy.deviceStorage.unavailable}
            </p>
          )}
          <StoragePlace
            body={copy.deviceStorage.onDeviceBody}
            title={copy.deviceStorage.onDevice}
          />
          <StoragePlace
            body={copy.deviceStorage.onServerBody}
            title={copy.deviceStorage.onServer}
          />
          <StoragePlace
            body={copy.deviceStorage.withOthersBody}
            title={copy.deviceStorage.withOthers}
          />
          <HistoryBackupPanel session={session} />
        </div>
      )}
    </section>
  );
}
