import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import type { NodeNetwork } from '../../application/networks/ListNodeNetworks';
import type { IdentityResource, Session } from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';
import { NetworkInviteCode } from '../../domain/networks/NetworkInviteCode';
import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';
import { shortId } from '../../utils/formatting';

interface NodeSettingsDialogProps {
  node: { id: string; owner: null | string } | null;
  networks: NodeNetwork[];
  onClose: () => void;
  onNetworksUpdated: () => Promise<void>;
  session: Session;
}

export function NodeSettingsDialog({
  node,
  networks,
  onClose,
  onNetworksUpdated,
  session,
}: NodeSettingsDialogProps) {
  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [selectedNetworkId, setSelectedNetworkId] = useState(
    networks[0]?.id ?? '',
  );
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<'claim' | 'create' | 'join' | null>(
    null,
  );
  const [ownerIdentity, setOwnerIdentity] = useState<IdentityResource | null>(
    node?.owner === session.identity.id ? session.identity : null,
  );
  const isOwner = node?.owner === session.identity.id;
  const ownerProfile = isOwner ? session.identity.profile : ownerIdentity?.profile;
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
  const selectedNetworkCode =
    selectedNetwork?.key?.trim()
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

  const handleClaim = async () => {
    setError(null);
    setLoading('claim');
    try {
      await pigeonApplication.claimNode(session);
      await onNetworksUpdated();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : copy.nodeSettings.error,
      );
    }
    setLoading(null);
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading('create');
    try {
      await pigeonApplication.createNodeNetwork(session, createName.trim());
      setCreateName('');
      await onNetworksUpdated();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : copy.nodeSettings.error,
      );
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
      setError(
        caught instanceof Error ? caught.message : copy.nodeSettings.error,
      );
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
      <section className="glass-panel-strong relative z-10 grid max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-[2rem] shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <h2 className="text-xl font-black">
              {copy.nodeSettings.title}
            </h2>
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
          <div>
            <div className="mb-5 rounded-3xl bg-black/20 p-4">
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
                <button
                  key={network.id}
                  type="button"
                  onClick={() => {
                    if (!isOwner) return;
                    setSelectedNetworkId(network.id);
                    setCopied(false);
                  }}
                  className={cx(
                    'w-full rounded-2xl p-3 text-left transition',
                    !isOwner && 'cursor-default',
                    selectedNetwork?.id === network.id
                      ? 'bg-white text-slate-950'
                      : isOwner
                        ? 'bg-black/25 text-white hover:bg-white/10'
                        : 'bg-black/25 text-white',
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
                    {shortId(network.id)}
                  </div>
                </button>
              ))}
            </div>
            {isOwner && (
              <button
                type="button"
                disabled
                className="mt-3 w-full rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-black text-rose-100 opacity-55 disabled:cursor-not-allowed"
              >
                {copy.nodeSettings.removeUnavailable}
              </button>
            )}
          </div>

          {isOwner ? (
            <div className="space-y-5">
              <form
                onSubmit={handleCreate}
                className="rounded-3xl bg-black/20 p-4"
              >
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-white/35">
                    {copy.nodeSettings.createLabel}
                  </span>
                  <input
                    value={createName}
                    onChange={(event) => setCreateName(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                    placeholder={copy.network.namePlaceholder}
                    required
                  />
                </label>
                <button
                  type="submit"
                  disabled={loading !== null}
                  className="mt-3 w-full rounded-2xl bg-fuchsia-500 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {loading === 'create'
                    ? copy.nodeSettings.saving
                    : copy.nodeSettings.create}
                </button>
              </form>

              <form onSubmit={handleJoin} className="rounded-3xl bg-black/20 p-4">
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

            <div className="rounded-3xl bg-black/20 p-4">
              <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-white/35">
                {copy.nodeSettings.shareLabel}
              </div>
              <div className="truncate rounded-2xl bg-black/25 p-3 text-xs text-white/60">
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
              <div className="rounded-3xl border border-rose-300/25 bg-rose-500/15 p-4 text-sm leading-6 text-rose-100">
                {error}
              </div>
            )
          )}
        </div>
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
