import { FormEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import type { NodeNetwork } from '../../../../modules/networks/application/list-node-networks/ListNodeNetworks';
import type {
  IdentityResource,
  IpfsReplicationStatus,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../composition/applicationContainer';
import { NetworkInviteCode } from '../../../../modules/networks/domain/networkInviteCode';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import { shortId } from '../../../../shared/presentation/formatting';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { MetricCard } from '../../../../shared/presentation/components/MetricCard';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';

interface NodeSettingsDialogProps {
  node: { id: string; owner: null | string } | null;
  networks: NodeNetwork[];
  onClose: () => void;
  onNetworksUpdated: () => Promise<void>;
  session: Session;
}

const PUBLIC_NETWORK_NAMES = new Set(['public', 'public network']);

export function NodeSettingsDialog({
  networks,
  node,
  onClose,
  onNetworksUpdated,
  session,
}: NodeSettingsDialogProps) {
  useCloseOnEscape(onClose);

  const [joinCode, setJoinCode] = useState('');
  const [createName, setCreateName] = useState('');
  const [copiedNetworkId, setCopiedNetworkId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<
    'claim' | 'create' | 'join' | 'public' | 'remove' | null
  >(null);
  const [ownerIdentity, setOwnerIdentity] = useState<IdentityResource | null>(
    node?.owner === session.identity.id ? session.identity : null,
  );
  const [replicationError, setReplicationError] = useState<string | null>(null);
  const [replicationLoading, setReplicationLoading] = useState(true);
  const [replicationStatus, setReplicationStatus] =
    useState<IpfsReplicationStatus | null>(null);
  const isOwner = node?.owner === session.identity.id;
  const hasPublicNetwork = networks.some(isPublicNodeNetwork);
  const canCreatePublicNetwork =
    !!node && !hasPublicNetwork && (!node.owner || isOwner);
  const canRemoveNetworks = !!node && (!node.owner || isOwner);
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

    void applicationContainer
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

  useEffect(() => {
    if (!isOwner) {
      setReplicationError(null);
      setReplicationLoading(false);
      setReplicationStatus(null);

      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      setReplicationError(null);
      setReplicationLoading(true);
      try {
        const status =
          await applicationContainer.getIpfsReplicationStatus(session);

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
  }, [isOwner, session]);

  const handleClaim = async () => {
    setError(null);
    setLoading('claim');
    try {
      await applicationContainer.claimNode(session);
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

      await applicationContainer.joinNodeNetwork(
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

  const handleCreateNetwork = async (event: FormEvent) => {
    event.preventDefault();
    const name = createName.trim();

    if (!name) return;

    setError(null);
    setLoading('create');
    try {
      await applicationContainer.createNodeNetwork(session, name);
      setCreateName('');
      await onNetworksUpdated();
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.nodeSettings.error));
    }
    setLoading(null);
  };

  const handleCreatePublicNetwork = async () => {
    if (!canCreatePublicNetwork) return;

    setError(null);
    setLoading('public');
    try {
      await applicationContainer.createPublicNodeNetwork(
        node?.owner ? session : undefined,
      );
      await onNetworksUpdated();
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.nodeSettings.error));
    }
    setLoading(null);
  };

  const handleRemoveNetwork = async (network: NodeNetwork) => {
    if (!canRemoveNetworks || loading !== null) return;

    const confirmed = window.confirm(
      copy.nodeSettings.removeNetworkConfirm.replace(
        '{name}',
        networkDisplayName(network),
      ),
    );

    if (!confirmed) return;

    setError(null);
    setLoading('remove');
    try {
      await applicationContainer.removeNodeNetwork(
        network.id,
        node?.owner ? session : undefined,
      );
      setCopiedNetworkId((current) =>
        current === network.id ? null : current,
      );
      await onNetworksUpdated();
    } catch (caught) {
      setError(
        toUserErrorMessage(caught, copy.nodeSettings.removeNetworkError),
      );
    }
    setLoading(null);
  };

  const copyNetworkCode = async (network: NodeNetwork) => {
    const code = networkInviteCode(network);

    if (!code || !navigator.clipboard) return;

    await navigator.clipboard.writeText(code);
    setCopiedNetworkId(network.id);
    window.setTimeout(() => {
      setCopiedNetworkId((current) =>
        current === network.id ? null : current,
      );
    }, 1800);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-md">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <section className="glass-panel-strong relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl shadow-2xl shadow-black/40">
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

        <div className="min-h-0 overflow-y-auto">
          <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1.1fr]">
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
              {canCreatePublicNetwork && (
                <div className="mb-3 rounded-2xl border border-amber-200/20 bg-amber-300/10 p-3">
                  <div className="flex items-start gap-3">
                    <NetworkLockBadge publicNetwork />
                    <p className="min-w-0 text-xs leading-relaxed text-amber-50/70">
                      {copy.nodeSettings.publicNetworkBody}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCreatePublicNetwork()}
                    disabled={loading !== null}
                    className="mt-3 w-full rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {loading === 'public'
                      ? copy.nodeSettings.saving
                      : copy.nodeSettings.createPublicNetwork}
                  </button>
                </div>
              )}
              <div className="space-y-2">
                {networks.map((network) => {
                  const publicNetwork = isPublicNodeNetwork(network);
                  const inviteCode = networkInviteCode(network);

                  return (
                    <div
                      key={network.id}
                      className={cx(
                        'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border p-3 text-left transition',
                        publicNetwork
                          ? 'border-amber-200/20 bg-amber-300/10 text-amber-50'
                          : 'border-emerald-200/15 bg-emerald-300/10 text-white',
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <NetworkLockBadge publicNetwork={publicNetwork} />
                        <div className="min-w-0">
                          <div className="truncate font-black">
                            {networkDisplayName(network)}
                          </div>
                          <div className="truncate text-xs text-white/45">
                            {network.id}
                          </div>
                        </div>
                      </div>
                      {canRemoveNetworks && (
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void copyNetworkCode(network)}
                            disabled={!inviteCode}
                            className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
                            aria-label={copy.nodeSettings.copyCode}
                            title={
                              copiedNetworkId === network.id
                                ? copy.profile.copied
                                : copy.nodeSettings.copyCode
                            }
                          >
                            <CopyIcon copied={copiedNetworkId === network.id} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRemoveNetwork(network)}
                            disabled={loading !== null}
                            className="grid h-10 w-10 place-items-center rounded-2xl bg-rose-500/10 text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-45"
                            aria-label={copy.nodeSettings.removeNetwork}
                            title={copy.nodeSettings.removeNetwork}
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {isOwner ? (
              <div className="min-w-0 space-y-5">
                <form
                  onSubmit={handleCreateNetwork}
                  className="rounded-2xl bg-black/20 p-4"
                >
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-white/35">
                      {copy.nodeSettings.createLabel}
                    </span>
                    <input
                      value={createName}
                      onChange={(event) => setCreateName(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                      placeholder={copy.nodeSettings.createPlaceholder}
                      required
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={loading !== null || !createName.trim()}
                    className="mt-3 w-full rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {loading === 'create'
                      ? copy.nodeSettings.saving
                      : copy.nodeSettings.create}
                  </button>
                </form>

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

          {isOwner && (
            <ReplicationStatusPanel
              error={replicationError}
              loading={replicationLoading}
              status={replicationStatus}
            />
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function isPublicNodeNetwork(network: NodeNetwork): boolean {
  return PUBLIC_NETWORK_NAMES.has(network.name.trim().toLowerCase());
}

function networkDisplayName(network: NodeNetwork): string {
  return isPublicNodeNetwork(network)
    ? copy.nodeSettings.publicNetworkName
    : network.name;
}

function networkInviteCode(network: NodeNetwork): string {
  const key = network.key?.trim();

  if (!key) return '';

  return NetworkInviteCode.encode({
    id: network.id,
    key,
    name: network.name,
  });
}

function NetworkLockBadge({ publicNetwork }: { publicNetwork: boolean }) {
  return (
    <span
      className={cx(
        'grid h-9 w-9 shrink-0 place-items-center rounded-2xl border',
        publicNetwork
          ? 'border-amber-200/35 bg-amber-300/20 text-amber-200'
          : 'border-emerald-200/30 bg-emerald-300/15 text-emerald-200',
      )}
      aria-label={
        publicNetwork
          ? copy.nodeSettings.publicNetworkName
          : copy.nodeSettings.privateNetwork
      }
      title={
        publicNetwork
          ? copy.nodeSettings.publicNetworkName
          : copy.nodeSettings.privateNetwork
      }
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className="h-4 w-4"
      >
        <path
          d="M7.75 10V8.25a4.25 4.25 0 0 1 8.5 0V10m-9 0h9.5a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-9.5a1.5 1.5 0 0 1-1.5-1.5v-6a1.5 1.5 0 0 1 1.5-1.5Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    </span>
  );
}

function CopyIcon({ copied }: { copied: boolean }) {
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
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
    >
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

function TrashIcon() {
  return (
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
  status,
}: {
  error: string | null;
  loading: boolean;
  status: IpfsReplicationStatus | null;
}) {
  const summary = status?.summary;

  return (
    <section className="border-t border-white/10 p-5">
      <div className="mb-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-white/35">
            {copy.nodeSettings.replication}
          </div>
          <p className="mt-1 text-sm text-white/50">
            {copy.nodeSettings.replicationBody}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <MetricCard
          label={copy.nodeSettings.replicationContents}
          value={String(summary?.contentCount ?? 0)}
          variant="dark"
        />
        <MetricCard
          label={copy.nodeSettings.replicationTotalSize}
          value={formatBytes(summary?.totalSizeBytes ?? 0)}
          variant="dark"
        />
        <MetricCard
          label={copy.nodeSettings.replicationResponsible}
          value={String(summary?.localResponsibleCount ?? 0)}
          variant="dark"
        />
        <MetricCard
          label={copy.nodeSettings.replicationReleasable}
          value={String(summary?.releasableCount ?? 0)}
          variant="dark"
        />
      </div>

      {error && (
        <div className="mt-3 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      {!error && !loading && status?.summary.contentCount === 0 && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
          {copy.nodeSettings.replicationEmpty}
        </div>
      )}
    </section>
  );
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
