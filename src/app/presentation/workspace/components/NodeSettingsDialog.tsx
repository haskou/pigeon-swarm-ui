import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import type { NodeNetwork } from '../../../../contexts/networks/application/list-node-networks/ListNodeNetworks';
import type { Peer } from '../../../../contexts/networks/application/list-peers/ListPeers';
import type { NodeInfo } from '../../../../contexts/networks/infrastructure/http/NodeInfo';
import type {
  IdentityResource,
  IpfsReplicationStatus,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../composition/applicationContainer';
import { NetworkInviteCode } from '../../../../contexts/networks/domain/NetworkInviteCode';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import { shortId } from '../../../../shared/presentation/formatting';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { MetricCard } from '../../../../shared/presentation/components/MetricCard';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';

interface NodeSettingsDialogProps {
  node: (NodeInfo & { owner: null | string }) | null;
  networks: NodeNetwork[];
  onClose: () => void;
  onNetworksUpdated: () => Promise<void>;
  peersLoading: boolean;
  peers: Peer[];
  session: Session;
}

const PUBLIC_NETWORK_NAMES = new Set(['public', 'public network']);

type NodeSettingsSection = 'info' | 'networks' | 'peers';

export function NodeSettingsDialog({
  networks,
  node,
  onClose,
  onNetworksUpdated,
  peersLoading,
  peers,
  session,
}: NodeSettingsDialogProps) {
  const { close, state: transitionState } = useCloseTransition(onClose);

  useCloseOnEscape(close);

  const [joinCode, setJoinCode] = useState('');
  const [createName, setCreateName] = useState('');
  const [activeSection, setActiveSection] =
    useState<NodeSettingsSection>('info');
  const [copiedNetworkId, setCopiedNetworkId] = useState<string | null>(null);
  const [copiedNodeId, setCopiedNodeId] = useState(false);
  const [copiedPeerId, setCopiedPeerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
  const canJoinNetwork = isNetworkInviteCode(joinCode);
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
  const sections: ReadonlyArray<readonly [NodeSettingsSection, string]> = [
    ['info', copy.nodeSettings.infoTab],
    [
      'networks',
      copy.nodeSettings.networksTab.replace(
        '{count}',
        String(networks.length),
      ),
    ],
    [
      'peers',
      copy.nodeSettings.peersTab.replace('{count}', String(peers.length)),
    ],
  ];

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
    setNotice(null);
    setLoading('claim');
    try {
      await applicationContainer.claimNode(session);
      await onNetworksUpdated();
      setNotice(copy.nodeSettings.claimSuccess);
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.nodeSettings.error));
    }
    setLoading(null);
  };

  const handleJoin = async (event: FormEvent) => {
    event.preventDefault();
    if (!canJoinNetwork) return;

    setError(null);
    setNotice(null);
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
      setNotice(copy.nodeSettings.joinSuccess);
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
    setNotice(null);
    setLoading('create');
    try {
      await applicationContainer.createNodeNetwork(session, name);
      setCreateName('');
      await onNetworksUpdated();
      setNotice(copy.nodeSettings.createSuccess);
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.nodeSettings.error));
    }
    setLoading(null);
  };

  const handleCreatePublicNetwork = async () => {
    if (!canCreatePublicNetwork) return;

    setError(null);
    setNotice(null);
    setLoading('public');
    try {
      await applicationContainer.createPublicNodeNetwork(
        node?.owner ? session : undefined,
      );
      await onNetworksUpdated();
      setNotice(copy.nodeSettings.publicNetworkSuccess);
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
    setNotice(null);
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
      setNotice(copy.nodeSettings.removeNetworkSuccess);
    } catch (caught) {
      setError(
        toUserErrorMessage(caught, copy.nodeSettings.removeNetworkError),
      );
    }
    setLoading(null);
  };

  const copyNodeId = async () => {
    if (!node?.id || !navigator.clipboard) return;

    await navigator.clipboard.writeText(node.id);
    setCopiedNodeId(true);
    setNotice(copy.nodeSettings.nodeIdCopied);
    window.setTimeout(() => setCopiedNodeId(false), 1800);
  };

  const copyNetworkId = async (network: NodeNetwork) => {
    if (!navigator.clipboard) return;

    await navigator.clipboard.writeText(network.id);
    setCopiedNetworkId(network.id);
    setNotice(copy.nodeSettings.networkIdCopied);
    window.setTimeout(() => {
      setCopiedNetworkId((current) =>
        current === network.id ? null : current,
      );
    }, 1800);
  };

  const copyPeerId = async (peerId: string) => {
    if (!navigator.clipboard) return;

    await navigator.clipboard.writeText(peerId);
    setCopiedPeerId(peerId);
    setNotice(copy.peers.copiedPeerId);
    window.setTimeout(() => {
      setCopiedPeerId((current) => (current === peerId ? null : current));
    }, 1800);
  };

  return createPortal(
    <div
      className="app-overlay-scrim fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-md"
      data-state={transitionState}
    >
      <button
        type="button"
        className="absolute inset-0"
        onClick={close}
        aria-label={copy.dialog.close}
      />
      <section
        className="app-overlay-surface glass-panel-strong relative z-10 flex h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl shadow-2xl shadow-black/40 sm:h-[88vh] sm:max-h-[88vh]"
        data-state={transitionState}
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <h2 className="text-xl font-black">{copy.nodeSettings.title}</h2>
            <p className="mt-1 text-sm text-white/50">
              {copy.nodeSettings.body}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-xl font-black text-white/70 transition hover:bg-white/15"
            aria-label={copy.dialog.close}
          >
            ×
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-5 sm:grid sm:grid-cols-[220px_minmax(0,1fr)]">
          <NodeSettingsNavigation
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            sections={sections}
          />
          <div className="subtle-scrollbar min-h-0 overflow-y-auto pr-1">
            <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col">
              {(error || notice) && (
                <div
                  className={cx(
                    'mb-4 rounded-2xl border p-3 text-sm',
                    error
                      ? 'border-rose-300/25 bg-rose-500/15 text-rose-100'
                      : 'border-emerald-300/25 bg-emerald-500/15 text-emerald-100',
                  )}
                >
                  {error ?? notice}
                </div>
              )}

              {activeSection === 'info' && (
                <div className="grid content-start gap-3">
                  <section className="rounded-2xl bg-black/20 p-3">
                    {!node?.owner ? (
                      <div>
                        <h3 className="text-base font-black text-white">
                          {copy.nodeSettings.unclaimedTitle}
                        </h3>
                        <p className="mt-1 text-sm leading-5 text-white/55">
                          {copy.nodeSettings.unclaimedBody}
                        </p>
                        <button
                          type="button"
                          onClick={() => void handleClaim()}
                          disabled={loading !== null}
                          className="mt-3 rounded-xl bg-fuchsia-500 px-3 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {loading === 'claim'
                            ? copy.nodeSettings.saving
                            : copy.nodeSettings.claim}
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.18em] text-white/35">
                          {copy.nodeSettings.owner}
                        </div>
                        <div className="mt-2 border-l border-white/10 py-1 pl-3">
                          <div className="truncate text-sm font-black text-white">
                            {ownerLabel}
                          </div>
                          <div className="truncate text-xs text-white/50">
                            {ownerHandle}
                          </div>
                        </div>
                      </div>
                    )}
                  </section>

                  <section className="rounded-2xl bg-black/20 p-3">
                    <div className="mb-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/35">
                      {copy.nodeSettings.nodeId}
                    </div>
                    <div className="flex min-w-0 items-center gap-2">
                      <code
                        className="min-w-0 flex-1 truncate rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/70"
                        title={node?.id ?? undefined}
                      >
                        {node?.id ?? '--'}
                      </code>
                      <button
                        type="button"
                        onClick={() => void copyNodeId()}
                        disabled={!node?.id}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
                        aria-label={copy.nodeSettings.copyNodeId}
                        title={
                          copiedNodeId
                            ? copy.profile.copied
                            : copy.nodeSettings.copyNodeId
                        }
                      >
                        <CopyIcon copied={copiedNodeId} />
                      </button>
                    </div>
                  </section>

                  <NodeRuntimeSummary node={node} />

                  {isOwner && (
                    <ReplicationStatusPanel
                      error={replicationError}
                      loading={replicationLoading}
                      status={replicationStatus}
                    />
                  )}
                </div>
              )}

              {activeSection === 'networks' && (
                <div className="grid content-start gap-3">
                  {!node?.owner && (
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/55">
                      {copy.nodeSettings.unclaimedNetworkNote}
                    </div>
                  )}

                  {canCreatePublicNetwork && (
                    <div className="grid gap-3 rounded-2xl border border-amber-200/20 bg-amber-300/10 p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                      <NetworkLockBadge publicNetwork />
                      <p className="min-w-0 text-xs leading-relaxed text-amber-50/70">
                        {copy.nodeSettings.publicNetworkBody}
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleCreatePublicNetwork()}
                        disabled={loading !== null}
                        className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-45"
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
                              <div
                                className="truncate text-xs text-white/45"
                                title={network.id}
                              >
                                {network.id}
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void copyNetworkId(network)}
                              className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-white transition hover:bg-white/15"
                              aria-label={copy.nodeSettings.copyNetworkId}
                              title={
                                copiedNetworkId === network.id
                                  ? copy.profile.copied
                                  : copy.nodeSettings.copyNetworkId
                              }
                            >
                              <CopyIcon
                                copied={copiedNetworkId === network.id}
                              />
                            </button>
                            {canRemoveNetworks && (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleRemoveNetwork(network)
                                }
                                disabled={loading !== null}
                                className="grid h-10 w-10 place-items-center rounded-2xl bg-rose-500/10 text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-45"
                                aria-label={copy.nodeSettings.removeNetwork}
                                title={copy.nodeSettings.removeNetwork}
                              >
                                <TrashIcon />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {isOwner && (
                    <div className="grid gap-3 lg:grid-cols-2">
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
                            onChange={(event) =>
                              setCreateName(event.target.value)
                            }
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
                            onChange={(event) =>
                              setJoinCode(event.target.value)
                            }
                            className="min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                            placeholder={copy.network.inviteCodePlaceholder}
                            required
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={loading !== null || !canJoinNetwork}
                          className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {loading === 'join'
                            ? copy.nodeSettings.saving
                            : copy.nodeSettings.join}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}

              {activeSection === 'peers' && (
                <PeerStatusPanel
                  copiedPeerId={copiedPeerId}
                  loading={peersLoading}
                  onCopyPeerId={copyPeerId}
                  peers={peers}
                />
              )}
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function isPublicNodeNetwork(network: NodeNetwork): boolean {
  return PUBLIC_NETWORK_NAMES.has(network.name.trim().toLowerCase());
}

function NodeSettingsNavigation({
  activeSection,
  onSectionChange,
  sections,
}: {
  activeSection: NodeSettingsSection;
  onSectionChange: (section: NodeSettingsSection) => void;
  sections: ReadonlyArray<readonly [NodeSettingsSection, string]>;
}) {
  return (
    <nav className="mb-4 flex w-full max-w-full flex-wrap gap-2 overflow-visible rounded-2xl bg-black/20 p-2 sm:mb-0 sm:block sm:space-y-1">
      {sections.map(([section, label]) => (
        <button
          key={section}
          type="button"
          onClick={() => onSectionChange(section)}
          className={cx(
            'shrink-0 whitespace-nowrap rounded-xl border px-3 py-2 text-left text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/35 sm:block sm:w-full',
            activeSection === section
              ? 'border-white/10 bg-white/[0.09] text-white'
              : 'border-transparent text-white/55 hover:bg-white/8',
          )}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

function networkDisplayName(network: NodeNetwork): string {
  return isPublicNodeNetwork(network)
    ? copy.nodeSettings.publicNetworkName
    : network.name;
}

function isNetworkInviteCode(value: string): boolean {
  if (!value.trim()) return false;

  try {
    NetworkInviteCode.decode(value);

    return true;
  } catch {
    return false;
  }
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

function NodeRuntimeSummary({
  node,
}: {
  node: (NodeInfo & { owner: null | string }) | null;
}) {
  return (
    <section className="rounded-2xl bg-black/20 p-3">
      <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-white/35">
        {copy.nodeSettings.nodeDetails}
      </div>
      <div className="divide-y divide-white/10">
        <NodeDetailRow
          label={copy.nodeSettings.nodeType}
          value={nodeTypeLabel(node?.nodeType)}
        />
        <NodeDetailRow
          label={copy.nodeSettings.relay}
          value={relayStatusLabel(node?.relay)}
        />
        {node?.relay?.peerId ? (
          <NodeDetailRow
            label={copy.nodeSettings.relayPeer}
            title={node.relay.peerId}
            value={shortId(node.relay.peerId)}
          />
        ) : null}
      </div>
    </section>
  );
}

function NodeDetailRow({
  label,
  title,
  value,
}: {
  label: string;
  title?: string;
  value: string;
}) {
  return (
    <div className="grid gap-1 py-1.5 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
      <div className="text-white/45">{label}</div>
      <div className="min-w-0 truncate font-black text-white/75" title={title ?? value}>
        {value}
      </div>
    </div>
  );
}

function PeerStatusPanel({
  copiedPeerId,
  loading,
  onCopyPeerId,
  peers,
}: {
  copiedPeerId: string | null;
  loading: boolean;
  onCopyPeerId: (peerId: string) => Promise<void>;
  peers: Peer[];
}) {
  const sortedPeers = useMemo(() => sortedPeersByLastSeen(peers), [peers]);

  return (
    <section className="flex min-h-[28rem] flex-1 flex-col rounded-2xl bg-black/10 p-4">
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
          <div className="w-full max-w-md rounded-2xl border border-dashed border-white/15 bg-black/15 p-5 text-center">
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
        <div
          key={index}
          className="rounded-2xl border border-white/10 bg-black/15 p-3"
        >
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
  onCopyPeerId,
  peer,
}: {
  copied: boolean;
  onCopyPeerId: (peerId: string) => Promise<void>;
  peer: Peer;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/15 p-3 text-xs">
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
              <CopyIcon copied={copied} />
            </button>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-white/8 px-2 py-1 font-black text-white/65">
          {formatPeerLastSeen(peer.lastSeenAt)}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        <PeerBadges peer={peer} />
        <div
          className="truncate text-white/55"
          title={peer.owner || copy.peers.unclaimed}
        >
          {copy.peers.owner}:{' '}
          <span className="text-white/75">
            {peer.owner ? shortId(peer.owner) : copy.peers.unclaimed}
          </span>
        </div>
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

function PeerBadges({ peer }: { peer: Peer }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <PeerBadge value={nodeTypeLabel(peer.nodeType)} />
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

  return copy.peers.seenMinutesAgo.replace(
    '{count}',
    String(elapsedMinutes),
  );
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

function relayStatusLabel(
  relay:
    | {
        advertised: boolean;
        autoEnabled: boolean;
        enabled: boolean;
        running: boolean;
      }
    | undefined,
): string {
  if (!relay?.enabled) return copy.nodeSettings.relayDisabled;
  if (relay.running && relay.advertised) return copy.nodeSettings.relayAdvertised;
  if (relay.running) return copy.nodeSettings.relayRunning;
  if (relay.autoEnabled) return copy.nodeSettings.relayAutoEnabled;

  return copy.nodeSettings.relayEnabled;
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
    <section className="rounded-2xl bg-black/20 p-3">
      <div className="mb-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-white/35">
            {copy.nodeSettings.replication}
          </div>
          <p className="mt-1 text-sm text-white/50">
            {copy.nodeSettings.replicationBody}
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
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
