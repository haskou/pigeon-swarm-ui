import type { ReactElement } from 'react';

import type { NodeNetwork } from '../../../networks/application/list-node-networks/NodeNetwork';

import { cx } from '../../../../shared/presentation/cx';
import { shortId } from '../../../../shared/presentation/formatting';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { IdentityMemberRow } from '../components/IdentityMemberListPanel';
import { useIdentityPreview } from '../hooks/useIdentityPreview';

export function NodeLoginSummary({
  availableNetworks,
  className,
  ownerIdentityId,
  peerCount,
  peersLoading,
}: {
  availableNetworks: NodeNetwork[];
  className?: string;
  ownerIdentityId: string | null;
  peerCount: number;
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
          <div className="min-w-0 max-w-56 flex-1">
            <IdentityMemberRow
              className="!h-12 !min-h-12 !max-w-none !rounded-xl !p-2"
              interactive={false}
              item={{
                identity: owner.identity ?? undefined,
                identityId: ownerIdentityId,
                name:
                  owner.loaded && !owner.identity
                    ? shortId(ownerIdentityId)
                    : undefined,
                pictureUrl: owner.pictureUrl,
              }}
            />
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
        title={availableNetworks.map((network) => network.name).join(', ')}
        value={availableNetworksLabel(availableNetworks)}
      />
      <NodeLoginSummaryRow
        label={copy.auth.nodePeers}
        value={
          peersLoading
            ? copy.auth.nodePeersLoading
            : peerCount === 1
              ? copy.auth.nodePeersOne
              : copy.auth.nodePeersCount.replace('{count}', String(peerCount))
        }
      />
    </div>
  );
}

function availableNetworksLabel(availableNetworks: NodeNetwork[]): string {
  if (availableNetworks.length === 0) return copy.auth.nodeNetworksNone;

  return availableNetworks.map((network) => network.name).join(', ');
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
