import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import type { NodeNetwork } from '../../../../contexts/networks/application/list-node-networks/ListNodeNetworks';
import type { NetworkSynchronizationStatus } from '../../../../contexts/networks/application/find-network-synchronization/NetworkSynchronizationStatus';
import type { Peer } from '../../../../contexts/networks/application/list-peers/ListPeers';
import type { NodeRelayConfiguration } from '../../../../contexts/networks/application/configure-node-relay/NodeRelayConfiguration';
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
import { DialogHeader } from '../../../../shared/presentation/components/DialogHeader';
import { SettingsNavigation } from '../../../../shared/presentation/components/SettingsNavigation';
import { shortId } from '../../../../shared/presentation/formatting';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import { IdentityMemberRow } from '../../../../contexts/identities/presentation/components/IdentityMemberListPanel';
import { useIdentityPreview } from '../../../../contexts/identities/presentation/hooks/useIdentityPreview';
import { defaultNodeRelayConfiguration } from '../../../../contexts/networks/application/configure-node-relay/defaultNodeRelayConfiguration';
import { normalizeNodeRelayConfiguration } from '../../../../contexts/networks/application/configure-node-relay/normalizeNodeRelayConfiguration';
import { NodeRelayConfigurationForm } from '../../../../contexts/networks/presentation/components/NodeRelayConfigurationForm';

interface NodeSettingsDialogProps {
  networkSynchronizationStatus: NetworkSynchronizationStatus | null;
  node: (NodeInfo & { owner: null | string }) | null;
  networks: NodeNetwork[];
  onClose: () => void;
  onNetworksUpdated: () => Promise<void>;
  peersLoading: boolean;
  peers: Peer[];
  session: Session;
}

const PUBLIC_NETWORK_NAMES = new Set(['public', 'public network']);

type NodeSettingsSection = 'info' | 'networks' | 'peers' | 'relay';

export function NodeSettingsDialog({
  networkSynchronizationStatus,
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
  const [replicationError, setReplicationError] = useState<string | null>(null);
  const [replicationLoading, setReplicationLoading] = useState(true);
  const [replicationStatus, setReplicationStatus] =
    useState<IpfsReplicationStatus | null>(null);
  const [relayConfiguration, setRelayConfiguration] =
    useState<NodeRelayConfiguration>(() => defaultNodeRelayConfiguration());
  const [relayConfigurationLoaded, setRelayConfigurationLoaded] =
    useState(false);
  const [relayError, setRelayError] = useState<string | null>(null);
  const [relayLoading, setRelayLoading] = useState(false);
  const [relaySaving, setRelaySaving] = useState(false);
  const isOwner = node?.owner === session.identity.id;
  const hasPublicNetwork = networks.some(isPublicNodeNetwork);
  const canCreatePublicNetwork =
    !!node && !hasPublicNetwork && (!node.owner || isOwner);
  const canRemoveNetworks = !!node && (!node.owner || isOwner);
  const canJoinNetwork = isNetworkInviteCode(joinCode);
  const sections: ReadonlyArray<readonly [NodeSettingsSection, string]> = [
    ['info', copy.nodeSettings.infoTab],
    [
      'networks',
      copy.nodeSettings.networksTab.replace('{count}', String(networks.length)),
    ],
    ['relay', copy.nodeSettings.relayTab],
    [
      'peers',
      copy.nodeSettings.peersTab.replace('{count}', String(peers.length)),
    ],
  ];

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

  useEffect(() => {
    if (!isOwner) {
      setRelayConfiguration(defaultNodeRelayConfiguration());
      setRelayConfigurationLoaded(false);
      setRelayError(null);
      setRelayLoading(false);

      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      setRelayError(null);
      setRelayConfigurationLoaded(false);
      setRelayLoading(true);
      try {
        const configuration =
          await applicationContainer.getNodeRelayConfiguration(session);

        if (!cancelled) {
          setRelayConfiguration(normalizeNodeRelayConfiguration(configuration));
          setRelayConfigurationLoaded(true);
        }
      } catch (caught) {
        if (!cancelled) {
          setRelayConfigurationLoaded(false);
          setRelayError(
            toUserErrorMessage(caught, copy.nodeSettings.relayLoadError),
          );
        }
      }
      if (!cancelled) setRelayLoading(false);
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

  const copyNetworkCode = async (network: NodeNetwork) => {
    if (!navigator.clipboard) return;

    const canShareNetworkKey = isOwner && !!network.key;
    const text = canShareNetworkKey
      ? NetworkInviteCode.encode({
          id: network.id,
          key: network.key!,
          name: network.name,
        })
      : network.id;

    await navigator.clipboard.writeText(text);
    setCopiedNetworkId(network.id);
    setNotice(
      canShareNetworkKey
        ? copy.nodeSettings.codeCopied
        : copy.nodeSettings.networkIdCopied,
    );
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

  const handleSaveRelayConfiguration = async (event: FormEvent) => {
    event.preventDefault();
    if (!isOwner || relaySaving) return;

    setError(null);
    setNotice(null);
    setRelayError(null);
    setRelaySaving(true);
    try {
      const saved = await applicationContainer.updateNodeRelayConfiguration(
        relayConfiguration,
        session,
      );

      setRelayConfiguration(normalizeNodeRelayConfiguration(saved));
      setRelayConfigurationLoaded(true);
      setNotice(copy.nodeSettings.relaySaveSuccess);
    } catch (caught) {
      setRelayError(
        toUserErrorMessage(caught, copy.nodeSettings.relaySaveError),
      );
    }
    setRelaySaving(false);
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
        className="app-overlay-surface ui-dialog-surface relative z-10 flex h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col overflow-hidden sm:h-[88vh] sm:max-h-[88vh]"
        data-state={transitionState}
      >
        <DialogHeader
          description={copy.nodeSettings.body}
          title={copy.nodeSettings.title}
          onClose={close}
        />

        <div className="ui-settings-layout">
          <SettingsNavigation
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            sections={sections}
          />
          <div className="ui-settings-content subtle-scrollbar">
            <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col">
              {(error || notice) && (
                <div
                  className={cx(
                    'ui-inline-notice mb-4',
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
                  <section>
                    <h3 className="ui-section-heading pt-0">
                      {copy.nodeSettings.nodeDetails}
                    </h3>
                    <div className="overflow-hidden rounded-md border border-white/10 bg-black/10 px-4">
                      <div className="py-4">
                        {!node?.owner ? (
                          <div>
                            <h4 className="text-base font-bold text-white">
                              {copy.nodeSettings.unclaimedTitle}
                            </h4>
                            <p className="mt-1 text-sm leading-5 text-white/55">
                              {copy.nodeSettings.unclaimedBody}
                            </p>
                            <button
                              type="button"
                              onClick={() => void handleClaim()}
                              disabled={loading !== null}
                              className="ui-button ui-button-primary mt-3"
                            >
                              {loading === 'claim'
                                ? copy.nodeSettings.saving
                                : copy.nodeSettings.claim}
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div className="text-sm font-semibold text-white/55">
                              {copy.nodeSettings.owner}
                            </div>
                            <NodeOwnerIdentity
                              currentIdentity={session.identity}
                              ownerIdentityId={node.owner}
                            />
                          </div>
                        )}
                      </div>

                      <div className="border-t border-white/10 py-4">
                        <div className="mb-1.5 text-sm font-semibold text-white/55">
                          {copy.nodeSettings.nodeId}
                        </div>
                        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_2.25rem] items-center gap-2">
                          <code
                            className="min-w-0 truncate text-sm text-white/70"
                            title={node?.id ?? undefined}
                          >
                            {node?.id ?? '--'}
                          </code>
                          <button
                            type="button"
                            onClick={() => void copyNodeId()}
                            disabled={!node?.id}
                            className="ui-icon-button h-9 w-9 shrink-0"
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
                      </div>

                      <NodeRuntimeSummary
                        node={node}
                        relayConfiguration={
                          isOwner && relayConfigurationLoaded
                            ? relayConfiguration
                            : null
                        }
                      />
                    </div>
                  </section>

                  {isOwner && (
                    <>
                      <NetworkSynchronizationPanel
                        status={networkSynchronizationStatus}
                      />
                      <ReplicationStatusPanel
                        error={replicationError}
                        loading={replicationLoading}
                        status={replicationStatus}
                      />
                    </>
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
                    <div className="ui-inline-notice grid gap-3 border-amber-200/40 bg-amber-300/10 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                      <NetworkLockBadge publicNetwork />
                      <p className="min-w-0 text-xs leading-relaxed text-amber-50/70">
                        {copy.nodeSettings.publicNetworkBody}
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleCreatePublicNetwork()}
                        disabled={loading !== null}
                        className="ui-button ui-button-primary"
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
                      const canShareNetworkKey = isOwner && !!network.key;

                      return (
                        <div
                          key={network.id}
                          className={cx(
                            'ui-list-row grid w-full grid-cols-[minmax(0,1fr)_auto] text-left transition',
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
                              onClick={() => void copyNetworkCode(network)}
                              className="ui-icon-button"
                              aria-label={
                                canShareNetworkKey
                                  ? copy.nodeSettings.copyCode
                                  : copy.nodeSettings.copyNetworkId
                              }
                              title={
                                copiedNetworkId === network.id
                                  ? copy.profile.copied
                                  : canShareNetworkKey
                                    ? copy.nodeSettings.copyCode
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
                                className="ui-icon-button ui-button-danger"
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
                        className="ui-section p-4"
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
                            className="ui-field-control px-4 py-3 text-sm placeholder:text-white/30"
                            placeholder={copy.nodeSettings.createPlaceholder}
                            required
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={loading !== null || !createName.trim()}
                          className="ui-button ui-button-primary mt-3 w-full"
                        >
                          {loading === 'create'
                            ? copy.nodeSettings.saving
                            : copy.nodeSettings.create}
                        </button>
                      </form>

                      <form onSubmit={handleJoin} className="ui-section p-4">
                        <label className="block">
                          <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-white/35">
                            {copy.nodeSettings.joinLabel}
                          </span>
                          <textarea
                            value={joinCode}
                            onChange={(event) =>
                              setJoinCode(event.target.value)
                            }
                            className="ui-field-control min-h-24 resize-none px-4 py-3 text-sm placeholder:text-white/30"
                            placeholder={copy.network.inviteCodePlaceholder}
                            required
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={loading !== null || !canJoinNetwork}
                          className="ui-button mt-3 w-full"
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

              {activeSection === 'relay' && (
                <div className="grid content-start gap-3">
                  {!isOwner ? (
                    <div className="ui-inline-notice text-sm text-white/55">
                      {copy.nodeSettings.ownerOnlyRelay}
                    </div>
                  ) : relayLoading ? (
                    <div className="py-5 text-sm text-white/55">
                      {copy.nodeSettings.relayLoading}
                    </div>
                  ) : (
                    <form
                      className="grid gap-3"
                      onSubmit={handleSaveRelayConfiguration}
                    >
                      {relayError && (
                        <div className="ui-inline-notice border-rose-300/50 bg-rose-500/10 text-rose-100">
                          {relayError}
                        </div>
                      )}
                      <NodeRelayConfigurationForm
                        configuration={relayConfiguration}
                        disabled={relaySaving}
                        onChange={setRelayConfiguration}
                      />
                      <button
                        type="submit"
                        disabled={relaySaving}
                        className="ui-button ui-button-primary justify-self-end"
                      >
                        {relaySaving
                          ? copy.nodeSettings.saving
                          : copy.nodeSettings.relaySave}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {activeSection === 'peers' && (
                <PeerStatusPanel
                  copiedPeerId={copiedPeerId}
                  currentIdentity={session.identity}
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

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4">
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
  relayConfiguration,
}: {
  node: (NodeInfo & { owner: null | string }) | null;
  relayConfiguration: NodeRelayConfiguration | null;
}) {
  return (
    <div className="border-t border-white/10 py-3">
      <div className="divide-y divide-white/10">
        {relayConfiguration ? (
          <NodeDetailRow
            label={copy.nodeSettings.privateRelayDiscoverRecords}
            value={
              relayConfiguration.privateRelay.discoveryEnabled
                ? copy.nodeSettings.relayEnabled
                : copy.nodeSettings.relayDisabled
            }
          />
        ) : null}
        <NodeDetailRow
          label={copy.nodeSettings.relay}
          value={nodeRelayStatusLabel(relayConfiguration, node?.relay)}
        />
        {node?.relay?.peerId ? (
          <NodeDetailRow
            label={copy.nodeSettings.relayPeer}
            title={node.relay.peerId}
            value={shortId(node.relay.peerId)}
          />
        ) : null}
      </div>
    </div>
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
      <div
        className="min-w-0 truncate font-black text-white/75"
        title={title ?? value}
      >
        {value}
      </div>
    </div>
  );
}

function PeerStatusPanel({
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

function NodeOwnerIdentity({
  currentIdentity,
  ownerIdentityId,
}: {
  currentIdentity: IdentityResource;
  ownerIdentityId: string;
}) {
  const owner = useIdentityPreview(ownerIdentityId, currentIdentity);

  return (
    <div className="mt-2 w-full max-w-[18rem]">
      <IdentityMemberRow
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
  if (relay.running && relay.advertised)
    return copy.nodeSettings.relayAdvertised;
  if (relay.running) return copy.nodeSettings.relayRunning;
  if (relay.autoEnabled) return copy.nodeSettings.relayAutoEnabled;

  return copy.nodeSettings.relayEnabled;
}

function nodeRelayStatusLabel(
  relayConfiguration: NodeRelayConfiguration | null,
  relay:
    | {
        advertised: boolean;
        autoEnabled: boolean;
        enabled: boolean;
        running: boolean;
      }
    | undefined,
): string {
  if (!relayConfiguration) return relayStatusLabel(relay);

  return relayConfiguration.privateRelay.enabled
    ? copy.nodeSettings.relayEnabled
    : copy.nodeSettings.relayDisabled;
}

function NetworkSynchronizationPanel({
  status,
}: {
  status: NetworkSynchronizationStatus | null;
}) {
  return (
    <section className="ui-section py-3">
      <div className="mb-3">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-white/35">
          {copy.nodeSettings.synchronizationTitle}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-white/50">
          {copy.nodeSettings.synchronizationBody}
        </p>
      </div>

      {!status ? (
        <div className="border-y border-white/10 py-4 text-sm text-white/55">
          {copy.nodeSettings.synchronizationAwaitingSnapshot}
        </div>
      ) : status.networks.length === 0 ? (
        <div className="border-y border-white/10 py-4 text-sm text-white/55">
          {copy.nodeSettings.synchronizationEmpty}
        </div>
      ) : (
        <div className="divide-y divide-white/10 border-y border-white/10">
          {status.networks.map((network) => (
            <div
              className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              key={network.id}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-white/85">
                  {network.name}
                </div>
                <div className="mt-1 text-xs text-white/45">
                  {copy.nodeSettings.synchronizationStores
                    .replace('{converged}', String(network.convergedStoreCount))
                    .replace('{total}', String(network.totalStoreCount))}
                  {' · '}
                  {copy.nodeSettings.synchronizationConnectedPeers.replace(
                    '{count}',
                    String(network.connectedPeerIds.length),
                  )}
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

function networkSynchronizationStateLabel(
  state: NetworkSynchronizationStatus['networks'][number]['state'],
): string {
  if (state === 'converged') return copy.nodeSettings.synchronizationConverged;
  if (state === 'syncing') return copy.nodeSettings.synchronizationSyncing;

  return copy.nodeSettings.synchronizationWaitingForPeers;
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
    <section className="ui-section py-3">
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

      <div className="divide-y divide-white/10 border-y border-white/10">
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

      {error && (
        <div className="ui-inline-notice mt-3 border-rose-300/50 bg-rose-500/10 text-rose-100">
          {error}
        </div>
      )}

      {!error && !loading && status?.summary.contentCount === 0 && (
        <div className="mt-3 border-t border-white/10 py-4 text-sm text-white/55">
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
