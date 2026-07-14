import { FormEvent, useState } from 'react';

import type { NodeNetwork } from '../../../../contexts/networks/application/list-node-networks/ListNodeNetworks';
import type { NodeInfo } from '../../../../contexts/networks/infrastructure/http/NodeInfo';
import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { NetworkInviteCode } from '../../../../contexts/networks/domain/NetworkInviteCode';
import { cx } from '../../../../shared/presentation/cx';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { useTechnicalDetailsPreference } from '../../../../shared/presentation/preferences/useTechnicalDetailsPreference';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { applicationContainer } from '../../../composition/applicationContainer';

interface NodeNetworksPanelProps {
  networks: NodeNetwork[];
  node: (NodeInfo & { owner: null | string }) | null;
  onNetworksUpdated: () => Promise<void>;
  session: Session;
}

const PUBLIC_NETWORK_NAMES = new Set(['public', 'public network']);

type NetworkAction = 'create' | 'join';
type NetworkMutation = 'create' | 'join' | 'public' | 'remove' | null;

export function NodeNetworksPanel({
  networks,
  node,
  onNetworksUpdated,
  session,
}: NodeNetworksPanelProps) {
  const [technicalDetailsVisible] = useTechnicalDetailsPreference();
  const [copiedNetworkId, setCopiedNetworkId] = useState<string | null>(null);
  const [createName, setCreateName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState<NetworkMutation>(null);
  const [networkAction, setNetworkAction] = useState<NetworkAction>('create');
  const [notice, setNotice] = useState<string | null>(null);
  const isOwner = node?.owner === session.identity.id;
  const hasPublicNetwork = networks.some(isPublicNodeNetwork);
  const canCreatePublicNetwork =
    !!node && !hasPublicNetwork && (!node.owner || isOwner);
  const canRemoveNetworks = !!node && (!node.owner || isOwner);
  const canJoinNetwork = isNetworkInviteCode(joinCode);

  const handleJoin = async (event: FormEvent) => {
    event.preventDefault();

    if (!canJoinNetwork) return;

    beginMutation('join');
    try {
      const invite = NetworkInviteCode.decode(joinCode);

      await applicationContainer.networks.joinForNode(
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
    } finally {
      setLoading(null);
    }
  };

  const handleCreateNetwork = async (event: FormEvent) => {
    event.preventDefault();
    const name = createName.trim();

    if (!name) return;

    beginMutation('create');
    try {
      await applicationContainer.networks.createForNode(session, name);
      setCreateName('');
      await onNetworksUpdated();
      setNotice(copy.nodeSettings.createSuccess);
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.nodeSettings.error));
    } finally {
      setLoading(null);
    }
  };

  const handleCreatePublicNetwork = async () => {
    if (!canCreatePublicNetwork) return;

    beginMutation('public');
    try {
      await applicationContainer.networks.createPublic(
        node?.owner ? session : undefined,
      );
      await onNetworksUpdated();
      setNotice(copy.nodeSettings.publicNetworkSuccess);
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.nodeSettings.error));
    } finally {
      setLoading(null);
    }
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

    beginMutation('remove');
    try {
      await applicationContainer.networks.remove(
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
    } finally {
      setLoading(null);
    }
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

  const beginMutation = (mutation: Exclude<NetworkMutation, null>) => {
    setError(null);
    setNotice(null);
    setLoading(mutation);
  };

  return (
    <div className="grid content-start gap-6">
      {(error || notice) && (
        <div
          className={cx(
            'ui-inline-notice',
            error
              ? 'border-rose-300/25 bg-rose-500/15 text-rose-100'
              : 'border-emerald-300/25 bg-emerald-500/15 text-emerald-100',
          )}
        >
          {error ?? notice}
        </div>
      )}

      {!node?.owner && (
        <div className="border-y border-white/10 py-3 text-sm text-white/55">
          {copy.nodeSettings.unclaimedNetworkNote}
        </div>
      )}

      <NetworkList
        canRemoveNetworks={canRemoveNetworks}
        copiedNetworkId={copiedNetworkId}
        isOwner={isOwner}
        loading={loading}
        networks={networks}
        onCopyNetworkCode={copyNetworkCode}
        onRemoveNetwork={handleRemoveNetwork}
        technicalDetailsVisible={technicalDetailsVisible}
      />

      {canCreatePublicNetwork && (
        <section className="grid gap-3 border-b border-white/10 pb-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div>
            <h3 className="text-sm font-black text-white/80">
              {copy.nodeSettings.createPublicNetwork}
            </h3>
            <p className="mt-1 text-sm leading-6 text-white/45">
              {copy.nodeSettings.publicNetworkBody}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleCreatePublicNetwork()}
            disabled={loading !== null}
            className="ui-button"
          >
            {loading === 'public'
              ? copy.nodeSettings.saving
              : copy.nodeSettings.createPublicNetwork}
          </button>
        </section>
      )}

      {isOwner && (
        <section>
          <h3 className="text-sm font-black text-white/85">
            {copy.nodeSettings.addNetwork}
          </h3>
          <NetworkActionTabs
            action={networkAction}
            onChange={setNetworkAction}
          />
          {networkAction === 'create' ? (
            <CreateNetworkForm
              loading={loading}
              name={createName}
              onChange={setCreateName}
              onSubmit={handleCreateNetwork}
            />
          ) : (
            <JoinNetworkForm
              canJoin={canJoinNetwork}
              code={joinCode}
              loading={loading}
              onChange={setJoinCode}
              onSubmit={handleJoin}
            />
          )}
        </section>
      )}
    </div>
  );
}

function NetworkList({
  canRemoveNetworks,
  copiedNetworkId,
  isOwner,
  loading,
  networks,
  onCopyNetworkCode,
  onRemoveNetwork,
  technicalDetailsVisible,
}: {
  canRemoveNetworks: boolean;
  copiedNetworkId: string | null;
  isOwner: boolean;
  loading: NetworkMutation;
  networks: NodeNetwork[];
  onCopyNetworkCode: (network: NodeNetwork) => Promise<void>;
  onRemoveNetwork: (network: NodeNetwork) => Promise<void>;
  technicalDetailsVisible: boolean;
}) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h3 className="text-sm font-black text-white/85">
            {copy.nodeSettings.networks}
          </h3>
          <p className="mt-1 text-sm text-white/45">
            {copy.nodeSettings.networksBody}
          </p>
        </div>
        <span className="text-sm font-black tabular-nums text-white/40">
          {networks.length}
        </span>
      </div>
      <div className="divide-y divide-white/10 border-y border-white/10">
        {networks.length === 0 ? (
          <p className="py-5 text-sm text-white/50">
            {copy.nodeSettings.networksEmpty}
          </p>
        ) : (
          networks.map((network) => (
            <NetworkRow
              canRemove={canRemoveNetworks}
              canShareKey={isOwner && !!network.key}
              copied={copiedNetworkId === network.id}
              disabled={loading !== null}
              key={network.id}
              network={network}
              onCopy={onCopyNetworkCode}
              onRemove={onRemoveNetwork}
              technicalDetailsVisible={technicalDetailsVisible}
            />
          ))
        )}
      </div>
    </section>
  );
}

function NetworkRow({
  canRemove,
  canShareKey,
  copied,
  disabled,
  network,
  onCopy,
  onRemove,
  technicalDetailsVisible,
}: {
  canRemove: boolean;
  canShareKey: boolean;
  copied: boolean;
  disabled: boolean;
  network: NodeNetwork;
  onCopy: (network: NodeNetwork) => Promise<void>;
  onRemove: (network: NodeNetwork) => Promise<void>;
  technicalDetailsVisible: boolean;
}) {
  const publicNetwork = isPublicNodeNetwork(network);

  return (
    <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <NetworkLockBadge publicNetwork={publicNetwork} />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <div className="truncate font-black text-white/85">
              {networkDisplayName(network)}
            </div>
            <span
              className={cx(
                'shrink-0 text-[0.68rem] font-black uppercase tracking-[0.08em]',
                publicNetwork ? 'text-amber-200/70' : 'text-emerald-200/65',
              )}
            >
              {publicNetwork
                ? copy.nodeSettings.publicNetworkName
                : copy.nodeSettings.privateNetwork}
            </span>
          </div>
          {technicalDetailsVisible ? (
            <div className="truncate text-xs text-white/40" title={network.id}>
              {network.id}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {canShareKey || technicalDetailsVisible ? (
          <button
            type="button"
            onClick={() => void onCopy(network)}
            className="ui-icon-button"
            aria-label={
              canShareKey
                ? copy.nodeSettings.copyCode
                : copy.nodeSettings.copyNetworkId
            }
            title={
              copied
                ? copy.profile.copied
                : canShareKey
                  ? copy.nodeSettings.copyCode
                  : copy.nodeSettings.copyNetworkId
            }
          >
            <CopyIcon copied={copied} />
          </button>
        ) : null}
        {canRemove && (
          <button
            type="button"
            onClick={() => void onRemove(network)}
            disabled={disabled}
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
}

function NetworkActionTabs({
  action,
  onChange,
}: {
  action: NetworkAction;
  onChange: (action: NetworkAction) => void;
}) {
  return (
    <div className="mt-3 grid grid-cols-2 border-b border-white/10">
      {(['create', 'join'] as const).map((candidate) => (
        <button
          key={candidate}
          type="button"
          onClick={() => onChange(candidate)}
          className={cx(
            'border-b-2 px-3 py-2.5 text-sm font-black transition',
            action === candidate
              ? 'border-cyan-300 text-white'
              : 'border-transparent text-white/45 hover:text-white/70',
          )}
        >
          {candidate === 'create'
            ? copy.nodeSettings.createLabel
            : copy.nodeSettings.joinLabel}
        </button>
      ))}
    </div>
  );
}

function CreateNetworkForm({
  loading,
  name,
  onChange,
  onSubmit,
}: {
  loading: NetworkMutation;
  name: string;
  onChange: (name: string) => void;
  onSubmit: (event: FormEvent) => Promise<void>;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
    >
      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-white/35">
          {copy.nodeSettings.createLabel}
        </span>
        <input
          value={name}
          onChange={(event) => onChange(event.target.value)}
          className="ui-field-control px-4 py-3 text-sm placeholder:text-white/30"
          placeholder={copy.nodeSettings.createPlaceholder}
          required
        />
      </label>
      <button
        type="submit"
        disabled={loading !== null || !name.trim()}
        className="ui-button ui-button-primary"
      >
        {loading === 'create'
          ? copy.nodeSettings.saving
          : copy.nodeSettings.create}
      </button>
    </form>
  );
}

function JoinNetworkForm({
  canJoin,
  code,
  loading,
  onChange,
  onSubmit,
}: {
  canJoin: boolean;
  code: string;
  loading: NetworkMutation;
  onChange: (code: string) => void;
  onSubmit: (event: FormEvent) => Promise<void>;
}) {
  return (
    <form onSubmit={onSubmit} className="grid gap-3 pt-4">
      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-white/35">
          {copy.nodeSettings.joinLabel}
        </span>
        <textarea
          value={code}
          onChange={(event) => onChange(event.target.value)}
          className="ui-field-control min-h-24 resize-none px-4 py-3 text-sm placeholder:text-white/30"
          placeholder={copy.network.inviteCodePlaceholder}
          required
        />
      </label>
      <button
        type="submit"
        disabled={loading !== null || !canJoin}
        className="ui-button ui-button-primary justify-self-end"
      >
        {loading === 'join' ? copy.nodeSettings.saving : copy.nodeSettings.join}
      </button>
    </form>
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
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path
        d={copied ? 'm5 12 4 4 10-10' : 'M9 8.5h8.5v10H9zM6.5 15.5V5.5H15'}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={copied ? 2 : 1.8}
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
