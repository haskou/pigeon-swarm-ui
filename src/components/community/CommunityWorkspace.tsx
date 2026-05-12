import { useEffect, useMemo, useState } from 'react';

import type { NodeNetwork } from '../../application/networks/ListNodeNetworks';
import type {
  Community,
  CommunityTextChannel,
  IdentityResource,
  Session,
} from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';
import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';
import { shortId } from '../../utils/formatting';
import { identityName, profilePictureDataUrl } from '../../utils/identityDisplay';
import { toUserErrorMessage } from '../../utils/toUserErrorMessage';
import { Field } from '../auth/Field';

interface CommunityWorkspaceProps {
  community: Community;
  nodeNetworks: NodeNetwork[];
  onCommunityUpdated: (community: Community) => void;
  session: Session;
}

export function CommunityWorkspace({
  community,
  nodeNetworks,
  onCommunityUpdated,
  session,
}: CommunityWorkspaceProps) {
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    community.textChannels[0]?.id ?? null,
  );
  const [memberIdentities, setMemberIdentities] = useState<
    Record<string, IdentityResource>
  >({});
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [memberInput, setMemberInput] = useState('');
  const [channelName, setChannelName] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<'idle' | 'loading'>('idle');
  const owner = community.ownerIdentityId === session.identity.id;
  const networkName =
    nodeNetworks.find((network) => network.id === community.networkId)?.name ??
    shortId(community.networkId);
  const selectedChannel = community.textChannels.find(
    (channel) => channel.id === selectedChannelId,
  );
  const sortedMembers = useMemo(
    () =>
      community.memberIds.map((identityId) => ({
        identity: memberIdentities[identityId],
        identityId,
      })),
    [community.memberIds, memberIdentities],
  );

  useEffect(() => {
    const nextSelectedChannel =
      community.textChannels.find((channel) => channel.id === selectedChannelId)
        ?.id ??
      community.textChannels[0]?.id ??
      null;

    setSelectedChannelId(nextSelectedChannel);
  }, [community.textChannels, selectedChannelId]);

  useEffect(() => {
    let cancelled = false;

    void Promise.all(
      community.memberIds.map(async (identityId) => {
        try {
          return [identityId, await pigeonApplication.getIdentity(identityId)] as const;
        } catch {
          return [identityId, undefined] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;

      const nextIdentities: Record<string, IdentityResource> = {};

      for (const [identityId, identity] of entries) {
        if (identity) nextIdentities[identityId] = identity;
      }

      setMemberIdentities(nextIdentities);
    });

    return () => {
      cancelled = true;
    };
  }, [community.memberIds]);

  useEffect(() => {
    const banner = community.banner?.trim();

    setBannerUrl(null);
    if (!banner) return undefined;

    let cancelled = false;

    void pigeonApplication
      .getPublicFile(banner)
      .then((content) => {
        if (!cancelled) setBannerUrl(profilePictureDataUrl(content));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [community.banner]);

  const refreshCommunity = async () => {
    onCommunityUpdated(await pigeonApplication.getCommunity(session, community.id));
  };

  const addMember = async () => {
    const identityId = normalizeIdentityLookup(memberInput);

    if (!identityId || actionState === 'loading') return;

    setActionState('loading');
    setActionError(null);
    try {
      await pigeonApplication.addCommunityMember(session, community.id, identityId);
      setMemberInput('');
      await refreshCommunity();
    } catch (caught) {
      setActionError(toUserErrorMessage(caught, copy.communities.memberError));
    }
    setActionState('idle');
  };

  const createTextChannel = async () => {
    const name = channelName.trim();

    if (!name || actionState === 'loading') return;

    setActionState('loading');
    setActionError(null);
    try {
      const channel = await pigeonApplication.createCommunityTextChannel(
        session,
        community.id,
        name,
      );
      setChannelName('');
      onCommunityUpdated({
        ...community,
        textChannels: [...community.textChannels, channel],
      });
      setSelectedChannelId(channel.id);
    } catch (caught) {
      setActionError(toUserErrorMessage(caught, copy.communities.channelError));
    }
    setActionState('idle');
  };

  return (
    <>
      <aside className="glass-panel-strong flex h-full min-h-0 flex-col rounded-none p-4 sm:rounded-[2rem]">
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-white/35">
            {copy.communities.privateCommunity}
          </div>
          <h2 className="mt-1 truncate text-2xl font-black">
            {community.name}
          </h2>
          <div className="mt-1 truncate text-sm text-white/45" title={community.networkId}>
            {networkName}
          </div>
        </div>

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-white/35">
            {copy.communities.channels}
          </div>
          <div className="space-y-2">
            {community.textChannels.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
                {copy.communities.noChannels}
              </div>
            ) : (
              community.textChannels.map((channel) => (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => setSelectedChannelId(channel.id)}
                  className={cx(
                    'flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm font-black transition',
                    selectedChannelId === channel.id
                      ? 'bg-white text-slate-950'
                      : 'bg-white/8 text-white hover:bg-white/14',
                  )}
                >
                  <span className="text-white/45">#</span>
                  <span className="truncate">{channel.name}</span>
                </button>
              ))
            )}
          </div>

          {owner && (
            <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-3">
              <Field label={copy.communities.newChannel}>
                <div className="flex gap-2">
                  <input
                    value={channelName}
                    onChange={(event) => setChannelName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return;
                      event.preventDefault();
                      void createTextChannel();
                    }}
                    className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                    placeholder="general"
                  />
                  <button
                    type="button"
                    onClick={() => void createTextChannel()}
                    disabled={!channelName.trim() || actionState === 'loading'}
                    className="rounded-2xl bg-white px-3 py-2 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    +
                  </button>
                </div>
              </Field>
            </div>
          )}
        </div>
      </aside>

      <section className="glass-panel-strong flex min-h-0 flex-col overflow-hidden rounded-none sm:rounded-[2rem]">
        <header className="border-b border-white/10 p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 font-black text-slate-950">
              {bannerUrl ? (
                <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                community.name.slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-black">
                {selectedChannel ? `# ${selectedChannel.name}` : community.name}
              </h1>
              <p className="truncate text-sm text-white/50">
                {selectedChannel
                  ? copy.communities.channelMetadataOnly
                  : community.description}
              </p>
            </div>
          </div>
        </header>

        <div className="grid flex-1 place-items-center p-6 text-center">
          <div className="max-w-md">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white/10 text-3xl font-black">
              #
            </div>
            <h2 className="mt-5 text-2xl font-black">
              {copy.communities.channelsAreMetadata}
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/55">
              {copy.communities.channelsAreMetadataBody}
            </p>
          </div>
        </div>
      </section>

      <aside className="glass-panel hidden h-full min-h-0 overflow-y-auto rounded-[2rem] p-4 xl:block">
        <div className="overflow-hidden rounded-3xl bg-white/8">
          <div className="grid h-32 place-items-center overflow-hidden bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-5xl font-black text-slate-950">
            {bannerUrl ? (
              <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              community.name.slice(0, 1).toUpperCase()
            )}
          </div>
          <div className="p-4">
            <h2 className="font-black">{community.name}</h2>
            <p className="mt-2 text-sm leading-6 text-white/55">
              {community.description}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-white/35">
            {copy.communities.members}
          </div>
          <div className="space-y-2">
            {sortedMembers.map(({ identity, identityId }) => (
              <MemberRow
                key={identityId}
                identity={identity}
                identityId={identityId}
                owner={identityId === community.ownerIdentityId}
              />
            ))}
          </div>
        </div>

        {owner && (
          <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-3">
            <Field label={copy.communities.addMember}>
              <div className="flex gap-2">
                <input
                  value={memberInput}
                  onChange={(event) => setMemberInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    void addMember();
                  }}
                  className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                  placeholder="@ada or identity id"
                />
                <button
                  type="button"
                  onClick={() => void addMember()}
                  disabled={!memberInput.trim() || actionState === 'loading'}
                  className="rounded-2xl bg-white px-3 py-2 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  +
                </button>
              </div>
            </Field>
            {actionError && (
              <div className="mt-3 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-3 text-xs text-rose-100">
                {actionError}
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
}

function MemberRow({
  identity,
  identityId,
  owner,
}: {
  identity?: IdentityResource;
  identityId: string;
  owner: boolean;
}) {
  const name = identity ? (identityName(identity) ?? shortId(identity.id)) : shortId(identityId);

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/8 p-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 font-black text-slate-950">
        {name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-black">{name}</div>
        <div className="truncate text-xs text-white/45">
          {owner ? copy.communities.owner : (identity?.profile.handle ? `@${identity.profile.handle}` : shortId(identityId))}
        </div>
      </div>
    </div>
  );
}

function normalizeIdentityLookup(value: string): string {
  const trimmed = value.trim();

  return trimmed.startsWith('@') ? trimmed.slice(1).toLowerCase() : trimmed;
}
