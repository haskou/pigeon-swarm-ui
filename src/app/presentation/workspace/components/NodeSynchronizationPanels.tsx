import type { NetworkSynchronizationStatus } from '../../../../contexts/networks/presentation/view-models/NetworkSynchronizationStatus';
import type { IpfsReplicationStatus } from '../../../../shared/domain/pigeonResources.types';

import { cx } from '../../../../shared/presentation/cx';
import { copy } from '../../../../shared/presentation/i18n/copy';

export function NetworkSynchronizationPanel({
  status,
}: {
  status: NetworkSynchronizationStatus | null;
}) {
  return (
    <section className="border-t border-white/10 pt-6">
      <div className="mb-3">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-white/35">
          {copy.nodeSettings.synchronizationTitle}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-white/50">
          {copy.nodeSettings.synchronizationBody}
        </p>
      </div>

      {!status ? (
        <div className="py-3 text-sm text-white/55">
          {copy.nodeSettings.synchronizationAwaitingSnapshot}
        </div>
      ) : status.networks.length === 0 ? (
        <div className="py-3 text-sm text-white/55">
          {copy.nodeSettings.synchronizationEmpty}
        </div>
      ) : (
        <div className="grid gap-2">
          {status.networks.map((network) => (
            <div
              className="flex flex-col gap-1.5 py-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              key={network.id}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-white/85">
                  {network.name}
                </div>
                <div className="mt-1 text-xs text-white/45">
                  {networkSynchronizationProgressLabel(network)}
                  {' · '}
                  {networkConnectionCountLabel(network.connectedPeerIds.length)}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs font-black">
                <span
                  className={cx(
                    'h-2 w-2 rounded-full',
                    network.state === 'converged'
                      ? 'bg-emerald-300'
                      : network.state === 'syncing'
                        ? 'animate-pulse bg-amber-300'
                        : 'bg-white/35',
                  )}
                />
                <span className="text-white/65">
                  {networkSynchronizationStateLabel(network.state)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {status ? (
        <div className="mt-2 text-right text-xs text-white/35">
          {copy.nodeSettings.synchronizationChangedAt.replace(
            '{date}',
            new Date(status.changedAt).toLocaleString(),
          )}
        </div>
      ) : null}
    </section>
  );
}

export function ReplicationStatusPanel({
  error,
  loading,
  status,
}: {
  error: string | null;
  loading: boolean;
  status: IpfsReplicationStatus | null;
}) {
  const summary = status?.summary;

  return (
    <section className="border-t border-white/10 pt-6">
      <div className="mb-3">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-white/35">
          {copy.nodeSettings.replication}
        </div>
        <p className="mt-1 text-sm text-white/50">
          {copy.nodeSettings.replicationBody}
        </p>
      </div>

      <div className="grid gap-x-8 sm:grid-cols-2">
        <NodeDetailRow
          label={copy.nodeSettings.replicationContents}
          value={String(summary?.contentCount ?? 0)}
        />
        <NodeDetailRow
          label={copy.nodeSettings.replicationTotalSize}
          value={formatBytes(summary?.totalSizeBytes ?? 0)}
        />
        <NodeDetailRow
          label={copy.nodeSettings.replicationResponsible}
          value={String(summary?.localResponsibleCount ?? 0)}
        />
        <NodeDetailRow
          label={copy.nodeSettings.replicationReleasable}
          value={String(summary?.releasableCount ?? 0)}
        />
      </div>

      {error ? (
        <div className="ui-inline-notice mt-3 border-rose-300/50 bg-rose-500/10 text-rose-100">
          {error}
        </div>
      ) : null}

      {!error && !loading && status?.summary.contentCount === 0 ? (
        <div className="mt-3 py-3 text-sm text-white/55">
          {copy.nodeSettings.replicationEmpty}
        </div>
      ) : null}
    </section>
  );
}

function NodeDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-1.5 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
      <div className="text-white/45">{label}</div>
      <div className="min-w-0 truncate font-black text-white/75">{value}</div>
    </div>
  );
}

function networkSynchronizationProgressLabel(
  network: NetworkSynchronizationStatus['networks'][number],
): string {
  const percentage =
    network.totalStoreCount <= 0
      ? 0
      : Math.round(
          (network.convergedStoreCount / network.totalStoreCount) * 100,
        );

  return copy.nodeSettings.synchronizationProgress.replace(
    '{percentage}',
    String(percentage),
  );
}

function networkSynchronizationStateLabel(
  state: NetworkSynchronizationStatus['networks'][number]['state'],
): string {
  if (state === 'converged') return copy.nodeSettings.synchronizationConverged;
  if (state === 'syncing') return copy.nodeSettings.synchronizationSyncing;

  return copy.nodeSettings.synchronizationWaitingForPeers;
}

function networkConnectionCountLabel(count: number): string {
  return (
    count === 1
      ? copy.nodeSettings.synchronizationConnection
      : copy.nodeSettings.synchronizationConnections
  ).replace('{count}', String(count));
}

function formatBytes(bytes: number): string {
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: bytes >= 1024 * 1024 ? 1 : 0,
    style: 'unit',
    unit: byteUnit(bytes),
    unitDisplay: 'short',
  }).format(bytes / byteUnitDivisor(bytes));
}

function byteUnit(
  bytes: number,
): 'byte' | 'gigabyte' | 'kilobyte' | 'megabyte' {
  if (bytes >= 1024 * 1024 * 1024) return 'gigabyte';
  if (bytes >= 1024 * 1024) return 'megabyte';
  if (bytes >= 1024) return 'kilobyte';

  return 'byte';
}

function byteUnitDivisor(bytes: number): number {
  if (bytes >= 1024 * 1024 * 1024) return 1024 * 1024 * 1024;
  if (bytes >= 1024 * 1024) return 1024 * 1024;
  if (bytes >= 1024) return 1024;

  return 1;
}
