import type { ReactElement } from 'react';

import type { NetworkSynchronizationStatus } from '../../../networks/application/find-network-synchronization/NetworkSynchronizationStatus';
import type { NodeNetwork } from '../../../networks/application/list-node-networks/NodeNetwork';

import { cx } from '../../../../shared/presentation/cx';
import { shortId } from '../../../../shared/presentation/formatting';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { useIdentityPreview } from '../hooks/useIdentityPreview';

export function NodeLoginSummary({
  availableNetworks,
  className,
  ipfsPeerCount,
  networkSynchronizationStatus,
  ownerIdentityId,
  peersLoading,
}: {
  availableNetworks: NodeNetwork[];
  className?: string;
  ipfsPeerCount: number;
  networkSynchronizationStatus: NetworkSynchronizationStatus | null;
  ownerIdentityId: string | null;
  peersLoading: boolean;
}): ReactElement {
  const owner = useIdentityPreview(ownerIdentityId ?? undefined);

  return (
    <div
      className={cx(
        'grid gap-2 border-y border-white/10 py-3 text-sm',
        className,
      )}
    >
      <div className="text-xs font-black uppercase tracking-[0.16em] text-white/35">
        {copy.auth.nodeSummaryTitle}
      </div>
      {ownerIdentityId ? (
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
          <div className="shrink-0 text-white/45">{copy.auth.nodeOwner}</div>
          <div className="min-w-0 truncate text-right font-black text-white/75">
            {owner.identity?.profile.handle?.trim()
              ? `@${owner.identity.profile.handle.trim()}`
              : shortId(ownerIdentityId)}
          </div>
        </div>
      ) : (
        <NodeLoginSummaryRow
          label={copy.auth.nodeOwner}
          value={copy.auth.nodeOwnerUnclaimed}
        />
      )}
      <NodeLoginSummaryRow
        label={copy.auth.networksLabel}
        title={availableNetworksLabel(
          availableNetworks,
          networkSynchronizationStatus,
          peersLoading,
        )}
        value={availableNetworksLabel(
          availableNetworks,
          networkSynchronizationStatus,
          peersLoading,
        )}
      />
      <NodeLoginSummaryRow
        label={copy.auth.nodePeers}
        value={
          peersLoading
            ? copy.auth.nodePeersLoading
            : ipfsPeerCount === 1
              ? copy.auth.nodePeersOne
              : copy.auth.nodePeersCount.replace(
                  '{count}',
                  String(ipfsPeerCount),
                )
        }
      />
    </div>
  );
}

function NodeLoginSummaryRow({
  label,
  title,
  value,
}: {
  label: string;
  title?: string;
  value: string;
}): ReactElement {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white/45">{label}</span>
      <span
        className="min-w-0 truncate text-right font-black text-white/75"
        title={title ?? value}
      >
        {value}
      </span>
    </div>
  );
}

function availableNetworksLabel(
  availableNetworks: NodeNetwork[],
  status: NetworkSynchronizationStatus | null,
  loading: boolean,
): string {
  if (availableNetworks.length === 0) return copy.auth.nodeNetworksNone;

  return availableNetworks
    .map(
      (network) =>
        `${network.name} · ${networkSynchronizationLabel(
          network.id,
          status,
          loading,
        )}`,
    )
    .join(' · ');
}

function networkSynchronizationLabel(
  networkId: string,
  status: NetworkSynchronizationStatus | null,
  loading: boolean,
): string {
  if (loading) return copy.auth.nodeNetworkSyncLoading;

  const network = status?.networks.find((item) => item.id === networkId);

  if (!network || network.totalStoreCount <= 0) {
    return copy.auth.nodeNetworkSyncUnavailable;
  }

  return copy.nodeSettings.synchronizationProgress.replace(
    '{percentage}',
    String(
      Math.round((network.convergedStoreCount / network.totalStoreCount) * 100),
    ),
  );
}
