import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import type { NodeNetwork } from '../../application/networks/ListNodeNetworks';
import type {
  IdentityResource,
  IpfsReplicationContentStatus,
  IpfsReplicationNetworkStatus,
  IpfsReplicationStatus,
  Session,
} from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';
import { NetworkInviteCode } from '../../domain/networks/NetworkInviteCode';
import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';
import { shortId } from '../../utils/formatting';
import { toUserErrorMessage } from '../../utils/toUserErrorMessage';

interface NodeSettingsDialogProps {
  node: { id: string; owner: null | string } | null;
  networks: NodeNetwork[];
  onClose: () => void;
  onNetworksUpdated: () => Promise<void>;
  session: Session;
}

export function NodeSettingsDialog({
  networks,
  node,
  onClose,
  onNetworksUpdated,
  session,
}: NodeSettingsDialogProps) {
  const [joinCode, setJoinCode] = useState('');
  const [selectedNetworkId, setSelectedNetworkId] = useState(
    networks[0]?.id ?? '',
  );
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<'claim' | 'join' | null>(null);
  const [ownerIdentity, setOwnerIdentity] = useState<IdentityResource | null>(
    node?.owner === session.identity.id ? session.identity : null,
  );
  const [replicationError, setReplicationError] = useState<string | null>(null);
  const [replicationLoading, setReplicationLoading] = useState(true);
  const [replicationStatus, setReplicationStatus] =
    useState<IpfsReplicationStatus | null>(null);
  const isOwner = node?.owner === session.identity.id;
  const ownerProfile = isOwner
    ? session.identity.profile
    : ownerIdentity?.profile;
  const ownerName = ownerProfile?.name.trim();
  const ownerLabel = !node?.owner
    ? copy.nodeSettings.unclaimed
    : ownerName || shortId(node.owner);
  const ownerHandle =
    ownerProfile?.handle?.trim() && node?.owner
      ? `@${ownerProfile.handle.trim()}`
      : node?.owner
        ? shortId(node.owner)
        : copy.nodeSettings.claimAvailable;
  const selectedNetwork = useMemo(
    () =>
      networks.find((network) => network.id === selectedNetworkId) ??
      networks[0],
    [networks, selectedNetworkId],
  );
  const selectedNetworkCode = selectedNetwork?.key?.trim()
    ? NetworkInviteCode.encode({
        id: selectedNetwork.id,
        key: selectedNetwork.key,
        name: selectedNetwork.name,
      })
    : '';

  useEffect(() => {
    if (!node?.owner) {
      setOwnerIdentity(null);

      return;
    }

    if (node.owner === session.identity.id) {
      setOwnerIdentity(session.identity);

      return;
    }

    let cancelled = false;

    void pigeonApplication
      .getIdentity(node.owner)
      .then((identity) => {
        if (!cancelled) setOwnerIdentity(identity);
      })
      .catch(() => {
        if (!cancelled) setOwnerIdentity(null);
      });

    return () => {
      cancelled = true;
    };
  }, [node?.owner, session.identity]);

  const loadReplicationStatus = async () => {
    setReplicationError(null);
    setReplicationLoading(true);
    try {
      setReplicationStatus(
        await pigeonApplication.getIpfsReplicationStatus(session),
      );
    } catch (caught) {
      setReplicationError(
        toUserErrorMessage(caught, copy.nodeSettings.replicationError),
      );
    }
    setReplicationLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setReplicationError(null);
      setReplicationLoading(true);
      try {
        const status = await pigeonApplication.getIpfsReplicationStatus(session);

        if (!cancelled) setReplicationStatus(status);
      } catch (caught) {
        if (!cancelled) {
          setReplicationError(
            toUserErrorMessage(caught, copy.nodeSettings.replicationError),
          );
        }
      }
      if (!cancelled) setReplicationLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const handleClaim = async () => {
    setError(null);
    setLoading('claim');
    try {
      await pigeonApplication.claimNode(session);
      await onNetworksUpdated();
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.nodeSettings.error));
    }
    setLoading(null);
  };

  const handleJoin = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading('join');
    try {
      const invite = NetworkInviteCode.decode(joinCode);

      await pigeonApplication.joinNodeNetwork(
        session,
        invite.id,
        invite.name,
        invite.key,
      );
      setJoinCode('');
      await onNetworksUpdated();
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.nodeSettings.error));
    }
    setLoading(null);
  };

  const copyNetworkCode = async () => {
    if (!selectedNetworkCode || !navigator.clipboard) return;

    await navigator.clipboard.writeText(selectedNetworkCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-md">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <section className="glass-panel-strong relative z-10 grid max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <h2 className="text-xl font-black">{copy.nodeSettings.title}</h2>
            <p className="mt-1 text-sm text-white/50">
              {copy.nodeSettings.body}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-xl font-black text-white/70 transition hover:bg-white/15"
            aria-label={copy.dialog.close}
          >
            ×
          </button>
        </div>

        <div className="grid min-h-0 gap-5 overflow-y-auto p-5 lg:grid-cols-[1fr_1.1fr]">
          <div className="min-w-0">
            <div className="mb-5 rounded-2xl bg-black/20 p-4">
              <div className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-white/35">
                {copy.nodeSettings.server}
              </div>
              <ServerField
                label={copy.nodeSettings.nodeId}
                value={node?.id ?? '--'}
              />
              <div className="mt-3">
                <div className="mb-1 text-xs font-black uppercase tracking-[0.18em] text-white/35">
                  {copy.nodeSettings.owner}
                </div>
                <div className="rounded-2xl bg-black/25 px-3 py-2">
                  <div className="truncate text-sm font-black text-white">
                    {ownerLabel}
                  </div>
                  <div className="truncate text-xs text-white/50">
                    {ownerHandle}
                  </div>
                </div>
              </div>
              {!node?.owner && (
                <button
                  type="button"
                  onClick={() => void handleClaim()}
                  disabled={loading !== null}
                  className="mt-3 w-full rounded-2xl bg-fuchsia-500 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {loading === 'claim'
                    ? copy.nodeSettings.saving
                    : copy.nodeSettings.claim}
                </button>
              )}
            </div>

            <div className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-white/35">
              {copy.nodeSettings.networks}
            </div>
            <div className="space-y-2">
              {networks.map((network) => (
                <div
                  key={network.id}
                  className={cx(
                    'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-2xl p-3 text-left transition',
                    selectedNetwork?.id === network.id
                      ? 'bg-white text-slate-950'
                      : isOwner
                        ? 'bg-black/25 text-white hover:bg-white/10'
                        : 'bg-black/25 text-white',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (!isOwner) return;
                      setSelectedNetworkId(network.id);
                      setCopied(false);
                    }}
                    className={cx(
                      'min-w-0 text-left',
                      !isOwner && 'cursor-default',
                    )}
                  >
                    <div className="truncate font-black">{network.name}</div>
                    <div
                      className={cx(
                        'truncate text-xs',
                        selectedNetwork?.id === network.id
                          ? 'text-slate-500'
                          : 'text-white/45',
                      )}
                    >
                      {network.id}
                    </div>
                  </button>
                  {isOwner && (
                    <button
                      type="button"
                      disabled
                      className={cx(
                        'grid h-9 w-9 place-items-center rounded-2xl transition disabled:cursor-not-allowed disabled:opacity-55',
                        selectedNetwork?.id === network.id
                          ? 'bg-slate-950/10 text-slate-700'
                          : 'bg-rose-500/10 text-rose-100',
                      )}
                      aria-label={copy.nodeSettings.removeUnavailable}
                      title={copy.nodeSettings.removeUnavailable}
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="h-4 w-4"
                      >
                        <path
                          d="M6 7h12M10 7V5h4v2m-6 3 .5 8h7l.5-8"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.8"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {isOwner ? (
            <div className="min-w-0 space-y-5">
              <form
                onSubmit={handleJoin}
                className="rounded-2xl bg-black/20 p-4"
              >
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-white/35">
                    {copy.nodeSettings.joinLabel}
                  </span>
                  <textarea
                    value={joinCode}
                    onChange={(event) => setJoinCode(event.target.value)}
                    className="min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                    placeholder={copy.network.inviteCodePlaceholder}
                    required
                  />
                </label>
                <button
                  type="submit"
                  disabled={loading !== null}
                  className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {loading === 'join'
                    ? copy.nodeSettings.saving
                    : copy.nodeSettings.join}
                </button>
              </form>

              <div className="min-w-0 rounded-2xl bg-black/20 p-4">
                <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-white/35">
                  {copy.nodeSettings.shareLabel}
                </div>
                <div className="block max-w-full truncate rounded-2xl bg-black/25 p-3 text-xs text-white/60">
                  {selectedNetworkCode || copy.nodeSettings.missingNetworkKey}
                </div>
                <button
                  type="button"
                  onClick={copyNetworkCode}
                  disabled={!selectedNetworkCode}
                  className="mt-3 w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {copied ? copy.profile.copied : copy.nodeSettings.copyCode}
                </button>
              </div>

              {error && (
                <div className="rounded-2xl border border-rose-300/25 bg-rose-500/15 p-3 text-sm text-rose-100">
                  {error}
                </div>
              )}
            </div>
          ) : (
            error && (
              <div className="rounded-2xl border border-rose-300/25 bg-rose-500/15 p-4 text-sm leading-6 text-rose-100">
                {error}
              </div>
            )
          )}
        </div>

        <ReplicationStatusPanel
          error={replicationError}
          loading={replicationLoading}
          onRefresh={() => void loadReplicationStatus()}
          status={replicationStatus}
        />
      </section>
    </div>,
    document.body,
  );
}

function ServerField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-xs font-black uppercase tracking-[0.18em] text-white/35">
        {label}
      </div>
      <div className="truncate rounded-2xl bg-black/25 px-3 py-2 text-sm text-white/70">
        {value}
      </div>
    </div>
  );
}

function ReplicationStatusPanel({
  error,
  loading,
  onRefresh,
  status,
}: {
  error: string | null;
  loading: boolean;
  onRefresh: () => void;
  status: IpfsReplicationStatus | null;
}) {
  const totals = replicationTotals(status);

  return (
    <section className="border-t border-white/10 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-white/35">
            {copy.nodeSettings.replication}
          </div>
          <p className="mt-1 text-sm text-white/50">
            {copy.nodeSettings.replicationBody}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {loading
            ? copy.nodeSettings.replicationLoading
            : copy.nodeSettings.replicationRefresh}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <ReplicationMetric
          label={copy.nodeSettings.replicationContents}
          value={String(totals.contentCount)}
        />
        <ReplicationMetric
          label={copy.nodeSettings.replicationTotalSize}
          value={formatBytes(totals.totalBytes)}
        />
        <ReplicationMetric
          label={copy.nodeSettings.replicationResponsible}
          value={String(totals.localResponsibleCount)}
        />
        <ReplicationMetric
          label={copy.nodeSettings.replicationReleasable}
          value={String(totals.releasableCount)}
        />
      </div>

      {status && (
        <div className="mt-3 truncate rounded-2xl bg-black/20 px-3 py-2 text-xs text-white/50">
          {copy.nodeSettings.replicationLocalNode}: {status.localNodeId}
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      {!error && !loading && status?.contents.length === 0 && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
          {copy.nodeSettings.replicationEmpty}
        </div>
      )}

      {status && status.contents.length > 0 && (
        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
          {status.contents.map((content) => (
            <ReplicationContentRow content={content} key={content.cid} />
          ))}
        </div>
      )}
    </section>
  );
}

function ReplicationMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-black/20 p-3">
      <div className="text-xs font-black uppercase tracking-[0.18em] text-white/35">
        {label}
      </div>
      <div className="mt-1 truncate text-lg font-black text-white">{value}</div>
    </div>
  );
}

function ReplicationContentRow({
  content,
}: {
  content: IpfsReplicationContentStatus;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-white">
            {content.cid}
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-white/45">
            <span>{content.context}</span>
            <span>{content.priority}</span>
            <span>{formatBytes(content.sizeBytes)}</span>
          </div>
        </div>
        <div className="text-right text-xs text-white/45">
          {formatTimestamp(content.updatedAt)}
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {content.networks.map((network) => (
          <ReplicationNetworkRow
            key={`${content.cid}-${network.networkId}`}
            network={network}
          />
        ))}
      </div>
    </article>
  );
}

function ReplicationNetworkRow({
  network,
}: {
  network: IpfsReplicationNetworkStatus;
}) {
  const badgeCopy = network.localResponsible
    ? copy.nodeSettings.replicationKeepLocal
    : network.releaseLocalReplica
      ? copy.nodeSettings.replicationReleaseLocal
      : copy.nodeSettings.replicationStandby;

  return (
    <div className="rounded-2xl bg-black/25 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 truncate text-xs font-black text-white">
          {network.networkId}
        </div>
        <span
          className={cx(
            'shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-black',
            network.localResponsible
              ? 'bg-emerald-400/15 text-emerald-100'
              : network.releaseLocalReplica
                ? 'bg-amber-400/15 text-amber-100'
                : 'bg-white/10 text-white/60',
          )}
        >
          {badgeCopy}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <MiniMetric
          label={copy.nodeSettings.replicationActiveNodes}
          value={network.activeNodeCount}
        />
        <MiniMetric
          label={copy.nodeSettings.replicationDesired}
          value={network.desiredReplicas}
        />
        <MiniMetric
          label={copy.nodeSettings.replicationKnown}
          value={network.knownReplicas}
        />
      </div>
      <div className="mt-2 truncate text-xs text-white/40">
        {copy.nodeSettings.replicationResponsibleNodes}:{' '}
        {network.responsibleNodeIds.join(', ') || '--'}
      </div>
      <div className="mt-1 truncate text-xs text-white/40">
        {copy.nodeSettings.replicationKnownNodes}:{' '}
        {network.knownReplicaNodeIds.join(', ') || '--'}
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/30">
        {label}
      </div>
      <div className="text-sm font-black text-white/75">{value}</div>
    </div>
  );
}

function replicationTotals(status: IpfsReplicationStatus | null): {
  contentCount: number;
  localResponsibleCount: number;
  releasableCount: number;
  totalBytes: number;
} {
  if (!status) {
    return {
      contentCount: 0,
      localResponsibleCount: 0,
      releasableCount: 0,
      totalBytes: 0,
    };
  }

  return status.contents.reduce(
    (totals, content) => ({
      contentCount: totals.contentCount + 1,
      localResponsibleCount:
        totals.localResponsibleCount +
        content.networks.filter((network) => network.localResponsible).length,
      releasableCount:
        totals.releasableCount +
        content.networks.filter((network) => network.releaseLocalReplica)
          .length,
      totalBytes: totals.totalBytes + content.sizeBytes,
    }),
    {
      contentCount: 0,
      localResponsibleCount: 0,
      releasableCount: 0,
      totalBytes: 0,
    },
  );
}

function formatBytes(bytes: number): string {
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: 1,
    notation: bytes >= 1_000_000 ? 'compact' : 'standard',
    style: 'unit',
    unit: 'byte',
    unitDisplay: 'narrow',
  }).format(bytes);
}

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}
