import { useMemo } from 'react';

import type { Peer } from '../../../../contexts/networks/presentation/view-models/Peer';
import type { IdentityResource } from '../../../../shared/domain/pigeonResources.types';

import { IdentityMemberRow } from '../../../../contexts/identities/presentation/components/IdentityMemberListPanel';
import { useIdentityPreview } from '../../../../contexts/identities/presentation/hooks/useIdentityPreview';
import { shortId } from '../../../../shared/presentation/formatting';
import { copy } from '../../../../shared/presentation/i18n/copy';

export function PeerStatusPanel({
  copiedPeerId,
  currentIdentity,
  loading,
  onCopyPeerId,
  peers,
}: {
  copiedPeerId: string | null;
  currentIdentity: IdentityResource;
  loading: boolean;
  onCopyPeerId: (peerId: string) => Promise<void>;
  peers: Peer[];
}) {
  const sortedPeers = useMemo(() => sortedPeersByLastSeen(peers), [peers]);

  return (
    <section className="flex min-h-[28rem] flex-1 flex-col">
      <div className="mb-4 shrink-0">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-white/35">
          {copy.peers.title}
        </div>
        <p className="mt-1 text-sm text-white/50">{copy.peers.body}</p>
      </div>
      {loading ? (
        <PeerSkeletonList />
      ) : sortedPeers.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center py-8">
          <div className="w-full max-w-md border-y border-dashed border-white/15 py-5 text-center">
            <div className="text-sm font-black text-white/75">
              {copy.peers.emptyTitle}
            </div>
            <p className="mt-1 text-sm leading-6 text-white/50">
              {copy.peers.empty}
            </p>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {sortedPeers.map((peer) => (
            <PeerSummary
              copied={copiedPeerId === peer.id}
              currentIdentity={currentIdentity}
              key={peer.id}
              onCopyPeerId={onCopyPeerId}
              peer={peer}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PeerSkeletonList() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="ui-list-block">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="h-4 w-40 rounded-full bg-white/10" />
              <div className="mt-2 h-3 w-full rounded-full bg-white/6" />
            </div>
            <div className="h-6 w-24 rounded-full bg-white/10" />
          </div>
          <div className="mt-3 flex gap-2">
            <div className="h-6 w-28 rounded-full bg-white/6" />
            <div className="h-6 w-20 rounded-full bg-white/6" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PeerSummary({
  copied,
  currentIdentity,
  onCopyPeerId,
  peer,
}: {
  copied: boolean;
  currentIdentity: IdentityResource;
  onCopyPeerId: (peerId: string) => Promise<void>;
  peer: Peer;
}) {
  return (
    <article className="ui-list-block text-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-black text-white">
            {copy.peers.node} · {shortId(peer.id)}
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-2">
            <code
              className="min-w-0 truncate text-[0.68rem] text-white/40"
              title={peer.id}
            >
              {peer.id}
            </code>
            <button
              type="button"
              onClick={() => void onCopyPeerId(peer.id)}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-white/8 text-white/65 transition hover:bg-white/12 hover:text-white"
              aria-label={copy.peers.copyPeerId}
              title={copied ? copy.profile.copied : copy.peers.copyPeerId}
            >
              <PeerCopyIcon copied={copied} />
            </button>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-white/8 px-2 py-1 font-black text-white/65">
          {formatPeerLastSeen(peer.lastSeenAt)}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        <PeerBadges peer={peer} />
        <PeerOwnerIdentity
          currentIdentity={currentIdentity}
          ownerIdentityId={peer.owner}
        />
        <div>
          <div className="mb-1 text-[0.62rem] font-black uppercase tracking-[0.14em] text-white/35">
            {copy.peers.networks}
          </div>
          {peer.networks.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {peer.networks.map((network) => (
                <span
                  key={`${peer.id}:${network.id}`}
                  className="max-w-full truncate rounded-full border border-cyan-200/15 bg-cyan-300/10 px-2 py-1 text-[0.68rem] font-black text-cyan-100/80"
                  title={network.name}
                >
                  {network.name}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-white/45">{copy.peers.noNetworks}</div>
          )}
        </div>
      </div>
    </article>
  );
}

function PeerOwnerIdentity({
  currentIdentity,
  ownerIdentityId,
}: {
  currentIdentity: IdentityResource;
  ownerIdentityId?: string;
}) {
  const owner = useIdentityPreview(ownerIdentityId, currentIdentity);

  if (!ownerIdentityId) {
    return (
      <div className="truncate text-white/55">
        {copy.peers.owner}:{' '}
        <span className="text-white/75">{copy.peers.unclaimed}</span>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 text-[0.62rem] font-black uppercase tracking-[0.14em] text-white/35">
        {copy.peers.owner}
      </div>
      <IdentityMemberRow
        className="max-w-[20rem]"
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
  );
}

function PeerBadges({ peer }: { peer: Peer }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {peer.nodeType && peer.nodeType !== 'unknown' ? (
        <PeerBadge value={nodeTypeLabel(peer.nodeType)} />
      ) : null}
      {peer.connectionSummary?.isSharedNetworkPeer ? (
        <PeerBadge
          value={copy.peers.sharedNetworks.replace(
            '{count}',
            String(peer.connectionSummary.sharedNetworkCount),
          )}
        />
      ) : null}
      {peer.capabilities?.gossipsub ? (
        <PeerBadge value={copy.peers.capabilityGossipsub} />
      ) : null}
      {peer.capabilities?.publicIpfs ? (
        <PeerBadge value={copy.peers.capabilityPublicIpfs} />
      ) : null}
      {peer.capabilities?.privateIpfs ? (
        <PeerBadge value={copy.peers.capabilityPrivateIpfs} />
      ) : null}
      {peer.capabilities?.relay ? (
        <PeerBadge value={copy.peers.capabilityRelay} />
      ) : null}
    </div>
  );
}

function PeerBadge({ value }: { value: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[0.65rem] font-black uppercase tracking-[0.08em] text-white/50">
      {value}
    </span>
  );
}

function sortedPeersByLastSeen(peers: Peer[]): Peer[] {
  return [...peers].sort(
    (left, right) => peerLastSeenRank(right) - peerLastSeenRank(left),
  );
}

function peerLastSeenRank(peer: Peer): number {
  return isValidLastSeenAt(peer.lastSeenAt) ? peer.lastSeenAt : -1;
}

function isValidLastSeenAt(lastSeenAt: number): boolean {
  return Number.isFinite(lastSeenAt) && lastSeenAt > 0;
}

function formatPeerLastSeen(lastSeenAt: number): string {
  if (!isValidLastSeenAt(lastSeenAt)) return copy.peers.neverSeen;

  const elapsedMs = Math.max(0, Date.now() - lastSeenAt);
  const elapsedMinutes = Math.floor(elapsedMs / 60000);

  if (elapsedMinutes <= 0) return copy.peers.seenJustNow;
  if (elapsedMinutes === 1) return copy.peers.seenMinuteAgo;

  return copy.peers.seenMinutesAgo.replace('{count}', String(elapsedMinutes));
}

function nodeTypeLabel(
  nodeType: 'leaf' | 'reachable' | 'relay' | 'unknown' | undefined,
): string {
  switch (nodeType) {
    case 'leaf':
      return copy.nodeSettings.nodeTypeLeaf;
    case 'reachable':
      return copy.nodeSettings.nodeTypeReachable;
    case 'relay':
      return copy.nodeSettings.nodeTypeRelay;
    default:
      return copy.nodeSettings.nodeTypeUnknown;
  }
}

function PeerCopyIcon({ copied }: { copied: boolean }) {
  if (copied) {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className="h-4 w-4 text-emerald-200"
      >
        <path
          d="m5 12 4 4 10-10"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path
        d="M9 8.5h8.5v10H9zM6.5 15.5V5.5H15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
