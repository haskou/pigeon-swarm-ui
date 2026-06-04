import {
  FormEvent,
  type ReactElement,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { NodeNetwork } from '../../../networks/application/list-node-networks/ListNodeNetworks';
import type {
  CommunityDiscoveryResource,
  CommunityMembershipRequest,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import { publicFileObjectUrl } from '../../../identities/presentation/view-models/identityDisplay';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { ClearableSearchInput } from '../../../../shared/presentation/components/ClearableSearchInput';
import { FallbackImage } from '../../../../shared/presentation/components/FallbackImage';
import { GlassSelect } from '../../../../shared/presentation/components/glassSelect';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { shortId } from '../../../../shared/presentation/formatting';

type CommunityDiscoveryDialogProps = {
  headerControl?: ReactElement;
  nodeNetworks: NodeNetwork[];
  onClose: () => void;
  onJoinRequested: (request: CommunityMembershipRequest) => void;
  session: Session;
};

export function CommunityDiscoveryDialog({
  headerControl,
  nodeNetworks,
  onClose,
  onJoinRequested,
  session,
}: CommunityDiscoveryDialogProps) {
  useCloseOnEscape(onClose);

  const [query, setQuery] = useState('');
  const [networkId, setNetworkId] = useState(
    session.identity.networks[0] ?? '',
  );
  const [communities, setCommunities] = useState<CommunityDiscoveryResource[]>(
    [],
  );
  const [state, setState] = useState<'idle' | 'loading'>('loading');
  const [joinCommunityId, setJoinCommunityId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const networkNames = useMemo(
    () => new Map(nodeNetworks.map((network) => [network.id, network.name])),
    [nodeNetworks],
  );
  const networkOptions = useMemo(
    () =>
      session.identity.networks.map((id) => ({
        label: networkNames.get(id) ?? id,
        value: id,
      })),
    [networkNames, session.identity.networks],
  );

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    const timeout = window.setTimeout(() => {
      setError(null);

      void applicationContainer
        .discoverCommunities(session, { networkId, query })
        .then((result) => {
          if (!cancelled) setCommunities(result);
        })
        .catch((caught) => {
          if (!cancelled) {
            setError(
              toUserErrorMessage(caught, copy.communities.discoverError),
            );
          }
        })
        .finally(() => {
          if (!cancelled) setState('idle');
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [networkId, query, session]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
  };

  const requestJoin = async (community: CommunityDiscoveryResource) => {
    if (joinCommunityId) return;

    setJoinCommunityId(community.id);
    setError(null);
    try {
      const request = await applicationContainer.createCommunityJoinRequest(
        session,
        community.id,
      );

      setCommunities((current) =>
        current.map((item) =>
          item.id === community.id
            ? {
                ...item,
              membershipRequest: request,
                membershipStatus:
                  request.status === 'accepted' ? 'member' : 'requested',
              }
            : item,
        ),
      );
      onJoinRequested(request);
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.communities.membershipError));
    }
    setJoinCommunityId(null);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-stretch bg-black/60 p-0 backdrop-blur-md sm:place-items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <section className="glass-panel-strong relative z-10 flex max-h-screen min-h-screen w-full flex-col overflow-hidden rounded-none p-5 shadow-2xl shadow-black/40 sm:min-h-0 sm:max-h-[88vh] sm:max-w-4xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight">
              {copy.communities.discoverTitle}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              {copy.communities.discoverHint}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.dialog.close}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 font-black"
          >
            x
          </button>
        </div>
        {headerControl}

        <form
          onSubmit={submitSearch}
          className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]"
        >
          <ClearableSearchInput
            ariaLabel={copy.communities.discoverSearch}
            clearLabel={copy.communities.clearCommunitySearch}
            value={query}
            onChange={setQuery}
            inputClassName="py-3 placeholder:text-white/35"
            placeholder={copy.communities.discoverSearch}
          />
          <GlassSelect
            ariaLabel={copy.communities.network}
            value={networkId}
            onChange={setNetworkId}
            options={networkOptions}
          />
        </form>

        {error && (
          <div className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        <div className="subtle-scrollbar mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-3">
          {state === 'loading' ? (
            <CommunityDiscoverySkeleton />
          ) : communities.length === 0 ? (
            <CommunityDiscoveryEmptyState
              networkName={networkNames.get(networkId) ?? shortId(networkId)}
            />
          ) : (
            communities.map((community) => (
              <CommunityDiscoveryRow
                community={community}
                disabled={joinCommunityId === community.id}
                key={community.id}
                networkName={
                  networkNames.get(community.networkId) ??
                  shortId(community.networkId)
                }
                onRequestJoin={() => void requestJoin(community)}
                showNetworkBadge={!networkId}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function CommunityDiscoverySkeleton() {
  return (
    <div className="space-y-3" aria-label={copy.communities.discoverLoading}>
      {Array.from({ length: 4 }, (_, index) => (
        <article
          className="animate-pulse rounded-2xl border border-white/10 bg-black/25 p-4"
          key={index}
        >
          <div className="flex gap-3">
            <div className="h-12 w-12 shrink-0 rounded-2xl bg-white/10" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="h-4 w-36 rounded-full bg-white/12" />
                <div className="h-5 w-20 rounded-full bg-white/8" />
                <div className="h-5 w-28 rounded-full bg-white/8" />
              </div>
              <div className="mt-3 h-3 w-full max-w-xl rounded-full bg-white/8" />
              <div className="mt-2 h-3 w-3/5 rounded-full bg-white/8" />
            </div>
            <div className="h-11 w-28 shrink-0 rounded-2xl bg-white/10" />
          </div>
        </article>
      ))}
    </div>
  );
}

function CommunityDiscoveryEmptyState({
  networkName,
}: {
  networkName: string;
}) {
  return (
    <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-white/15 bg-black/20 p-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/8 text-2xl">
          #
        </div>
        <h3 className="mt-4 text-lg font-black text-white">
          {copy.communities.discoverEmptyTitle}
        </h3>
        <p className="mt-2 text-sm leading-6 text-white/55">
          {copy.communities.discoverEmptyBody}
        </p>
        <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-black text-white/60">
          <span className="text-white/35">{copy.communities.network}</span>
          <span className="truncate">{networkName}</span>
        </div>
      </div>
    </div>
  );
}

function CommunityDiscoveryRow({
  community,
  disabled,
  networkName,
  onRequestJoin,
  showNetworkBadge,
}: {
  community: CommunityDiscoveryResource;
  disabled: boolean;
  networkName: string;
  onRequestJoin: () => void;
  showNetworkBadge: boolean;
}) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const avatar = community.avatar?.trim();

    setAvatarUrl(null);

    if (!avatar) return undefined;

    let cancelled = false;

    void applicationContainer
      .getPublicFile(avatar)
      .then((content) => publicFileObjectUrl(content))
      .then((url) => {
        if (!cancelled) setAvatarUrl(url);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [community.avatar]);

  const canRequest = community.membershipStatus === 'none';
  const showActionButton = community.membershipStatus === 'none';

  return (
    <article className="rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:border-white/18 hover:bg-white/5">
      <div className="flex gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-sm font-black text-slate-950">
          <FallbackImage
            src={avatarUrl}
            alt=""
            className="h-full w-full object-cover"
            fallback={community.name.slice(0, 1).toUpperCase()}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-black text-white">{community.name}</h3>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-black text-white/55">
              {formatMemberCount(community.memberCount)}
            </span>
            {showNetworkBadge ? (
              <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-fuchsia-300/10 px-2 py-0.5 text-xs font-black text-fuchsia-100/80">
                <span className="text-fuchsia-100/45">
                  {copy.communities.network}
                </span>
                <span className="max-w-40 truncate">{networkName}</span>
              </span>
            ) : null}
            {community.autoJoinEnabled && community.membershipStatus === 'none' ? (
              <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-xs font-black text-amber-100">
                {copy.communities.discoverJoinInstantly}
              </span>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-white/55">
            {community.description}
          </p>
        </div>
        {showActionButton ? (
          <button
            type="button"
            onClick={onRequestJoin}
            disabled={!canRequest || disabled}
            className={cx(
              'h-11 shrink-0 rounded-2xl px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-55',
              canRequest
                ? 'bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-950/30 hover:bg-fuchsia-400'
                : 'bg-white/10 text-white/70',
            )}
          >
            {membershipStatusLabel(community)}
          </button>
        ) : (
          <span className="inline-flex h-8 shrink-0 items-center rounded-full border border-white/10 bg-white/8 px-3 text-xs font-black text-white/65">
            {membershipStatusLabel(community)}
          </span>
        )}
      </div>
    </article>
  );
}

function formatMemberCount(count: number): string {
  const template =
    count === 1 ? copy.communities.memberCount : copy.communities.membersCount;

  return template.replace('{count}', String(count));
}

function membershipStatusLabel(community: CommunityDiscoveryResource): string {
  if (community.membershipStatus === 'member') {
    return `✓ ${copy.communities.discoverJoined}`;
  }

  if (community.membershipStatus === 'requested') {
    return copy.communities.discoverPendingRequest;
  }

  if (community.membershipStatus === 'invited') {
    return copy.communities.discoverPendingInvitation;
  }

  if (community.autoJoinEnabled) {
    return copy.communities.discoverJoinInstantly;
  }

  return copy.communities.discoverJoin;
}
