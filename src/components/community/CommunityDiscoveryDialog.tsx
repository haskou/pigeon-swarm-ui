import {
  FormEvent,
  type ReactElement,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { NodeNetwork } from '../../application/networks/ListNodeNetworks';
import type {
  CommunityDiscoveryResource,
  CommunityMembershipRequest,
  Session,
} from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';
import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';
import { publicFileObjectUrl } from '../../utils/identityDisplay';
import { toUserErrorMessage } from '../../utils/toUserErrorMessage';
import { GlassSelect } from '../common/GlassSelect';

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
  const [query, setQuery] = useState('');
  const [networkId, setNetworkId] = useState(
    session.identity.networks[0] ?? '',
  );
  const [communities, setCommunities] = useState<
    CommunityDiscoveryResource[]
  >([]);
  const [state, setState] = useState<'idle' | 'loading'>('idle');
  const [joinCommunityId, setJoinCommunityId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const networkOptions = useMemo(
    () =>
      session.identity.networks.map((id) => ({
        label: nodeNetworks.find((network) => network.id === id)?.name ?? id,
        value: id,
      })),
    [nodeNetworks, session.identity.networks],
  );

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', closeOnEscape);

    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setState('loading');
      setError(null);

      void pigeonApplication
        .discoverCommunities(session, { networkId, query })
        .then((result) => {
          if (!cancelled) setCommunities(result);
        })
        .catch((caught) => {
          if (!cancelled) {
            setError(toUserErrorMessage(caught, copy.communities.discoverError));
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
      const request = await pigeonApplication.createCommunityJoinRequest(
        session,
        community.id,
      );

      setCommunities((current) =>
        current.map((item) =>
          item.id === community.id
            ? {
                ...item,
                membershipRequest: request,
                membershipStatus: 'requested',
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
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/60"
            placeholder={copy.communities.discoverSearch}
            autoFocus
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

        <div className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {state === 'loading' && communities.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
              {copy.communities.discoverLoading}
            </div>
          )}
          {state === 'idle' && communities.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
              {copy.communities.discoverEmpty}
            </div>
          )}
          {communities.map((community) => (
            <CommunityDiscoveryRow
              community={community}
              disabled={joinCommunityId === community.id}
              key={community.id}
              onRequestJoin={() => void requestJoin(community)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function CommunityDiscoveryRow({
  community,
  disabled,
  onRequestJoin,
}: {
  community: CommunityDiscoveryResource;
  disabled: boolean;
  onRequestJoin: () => void;
}) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const avatar = community.avatar?.trim();

    setAvatarUrl(null);

    if (!avatar) return undefined;

    let cancelled = false;

    void pigeonApplication
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

  return (
    <article className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-sm font-black text-slate-950">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            community.name.slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-black text-white">
              {community.name}
            </h3>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-black text-white/55">
              {community.memberCount} {copy.communities.members}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-white/55">
            {community.description}
          </p>
        </div>
        <button
          type="button"
          onClick={onRequestJoin}
          disabled={!canRequest || disabled}
          className={cx(
            'h-11 shrink-0 rounded-2xl px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-55',
            canRequest
              ? 'bg-white text-slate-950 hover:bg-cyan-100'
              : 'bg-white/10 text-white/70',
          )}
        >
          {membershipStatusLabel(community)}
        </button>
      </div>
    </article>
  );
}

function membershipStatusLabel(community: CommunityDiscoveryResource): string {
  if (community.membershipStatus === 'member') {
    return copy.communities.discoverJoined;
  }

  if (community.membershipStatus === 'requested') {
    return copy.communities.discoverPendingRequest;
  }

  if (community.membershipStatus === 'invited') {
    return copy.communities.discoverPendingInvitation;
  }

  return copy.communities.discoverJoin;
}
