import { FormEvent, useEffect, useState } from 'react';
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
import { NodeNetworksPanel } from './NodeNetworksPanel';
import { PeerStatusPanel } from './PeerStatusPanel';
import {
  NetworkSynchronizationPanel,
  ReplicationStatusPanel,
} from './NodeSynchronizationPanels';

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

  const [activeSection, setActiveSection] =
    useState<NodeSettingsSection>('info');
  const [copiedNodeId, setCopiedNodeId] = useState(false);
  const [copiedPeerId, setCopiedPeerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [claimLoading, setClaimLoading] = useState(false);
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
          await applicationContainer.networks.getReplicationStatus(session);

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
          await applicationContainer.networks.getRelayConfiguration(session);

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
    setClaimLoading(true);
    try {
      await applicationContainer.networks.claimNode(session);
      await onNetworksUpdated();
      setNotice(copy.nodeSettings.claimSuccess);
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.nodeSettings.error));
    }
    setClaimLoading(false);
  };

  const copyNodeId = async () => {
    if (!node?.id || !navigator.clipboard) return;

    await navigator.clipboard.writeText(node.id);
    setCopiedNodeId(true);
    setNotice(copy.nodeSettings.nodeIdCopied);
    window.setTimeout(() => setCopiedNodeId(false), 1800);
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
      const saved = await applicationContainer.networks.updateRelayConfiguration(
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
                <div className="grid content-start gap-7">
                  <section>
                    <h3 className="ui-section-heading pt-0">
                      {copy.nodeSettings.nodeDetails}
                    </h3>
                    <div>
                      <div className="pb-4">
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
                              disabled={claimLoading}
                              className="ui-button ui-button-primary mt-3"
                            >
                              {claimLoading
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

                      <div className="py-3">
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
                <NodeNetworksPanel
                  networks={networks}
                  node={node}
                  onNetworksUpdated={onNetworksUpdated}
                  session={session}
                />
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

function NodeRuntimeSummary({
  node,
  relayConfiguration,
}: {
  node: (NodeInfo & { owner: null | string }) | null;
  relayConfiguration: NodeRelayConfiguration | null;
}) {
  return (
    <div className="py-2">
      <div className="grid gap-1">
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
