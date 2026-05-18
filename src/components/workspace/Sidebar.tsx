import { useEffect, useMemo, useState } from 'react';

import type { NodeNetwork } from '../../application/networks/ListNodeNetworks';
import type { CallSession } from '../../domain/calls/CallSession';
import type {
  ConversationResource,
  IdentityPresence,
  IdentityResource,
  SelectablePresenceStatus,
  Session,
} from '../../domain/types';

import { conversationPeerIdentityId } from '../../domain/conversations/conversationPeer';
import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';
import { conversationTitle, shortId } from '../../utils/formatting';
import {
  identityBanner,
  identityDisplayName,
  type IdentityNames,
  type IdentityPictures,
} from '../../utils/identityDisplay';
import { PresenceStatusDot } from '../presence/PresenceStatusDot';
import { SectionTitle } from '../common/SectionTitle';
import { loadPublicImage } from '../community/communityImages';
import { UserProfileDropdown } from './SessionIdentityDropdown';

interface SidebarProps {
  session: Session;
  conversations: ConversationResource[];
  nodeNetworks: NodeNetwork[];
  identityNames: IdentityNames;
  identityPictures: IdentityPictures;
  identityProfiles: Record<string, IdentityResource>;
  presenceByIdentityId?: Record<string, IdentityPresence>;
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onLogout: () => void;
  onSessionUpdated: (session: Session) => void;
  onPresenceChange?: (presence: IdentityPresence) => void;
  onPresenceStatusSelected?: (status: SelectablePresenceStatus) => void;
  activeCall?: CallSession | null;
  onCallEnd?: () => void;
  onCallParticipantVolumeChange?: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onCallToggleCamera?: () => void;
  onCallToggleDeafen?: () => void;
  onCallToggleMute?: () => void;
  onCallToggleScreenShare?: () => void;
}

export function Sidebar({
  activeCall,
  activeConversationId,
  conversations,
  identityNames,
  identityPictures,
  identityProfiles,
  presenceByIdentityId = {},
  nodeNetworks,
  onCallEnd,
  onCallParticipantVolumeChange,
  onCallToggleCamera,
  onCallToggleDeafen,
  onCallToggleMute,
  onCallToggleScreenShare,
  onCreate,
  onLogout,
  onSelect,
  onSessionUpdated,
  onPresenceChange,
  onPresenceStatusSelected,
  session,
}: SidebarProps) {
  const [conversationSearch, setConversationSearch] = useState('');
  const conversationBannerUrls = useIdentityBannerUrls(
    identityProfiles,
    filteredConversationPeerIdentityIds(
      conversations,
      session.identity.id,
      session.keychain,
    ),
  );
  const conversationPeerId = (conversation: ConversationResource) =>
    conversationPeerIdentityId(
      conversation,
      session.identity.id,
      session.keychain,
    );

  const conversationName = (conversation: ConversationResource) => {
    if (isGroupConversation(conversation)) {
      return conversation.name ?? conversation.title ?? conversation.id;
    }

    const peerIdentityId = conversationPeerId(conversation);
    const peerProfile = peerIdentityId
      ? identityProfiles[peerIdentityId]?.profile
      : undefined;
    const peerName = peerProfile?.name.trim();
    const peerHandle = peerProfile?.handle?.trim();

    return peerName
      ? peerName
      : peerHandle
        ? `@${peerHandle}`
        : peerIdentityId
          ? identityDisplayName(peerIdentityId, identityNames)
          : conversationTitle(conversation);
  };
  const conversationHandle = (conversation: ConversationResource) => {
    if (isGroupConversation(conversation)) {
      const memberCount = conversationParticipants(conversation).length;

      return `${memberCount} ${copy.sidebar.members}`;
    }

    const peerIdentityId = conversationPeerId(conversation);
    const peerHandle = peerIdentityId
      ? identityProfiles[peerIdentityId]?.profile.handle?.trim()
      : undefined;

    return peerHandle
      ? `@${peerHandle}`
      : peerIdentityId
        ? shortId(peerIdentityId)
        : conversationTitle(conversation);
  };
  const conversationPicture = (conversation: ConversationResource) => {
    if (isGroupConversation(conversation)) return undefined;

    const peerIdentityId = conversationPeerId(conversation);

    return peerIdentityId ? identityPictures[peerIdentityId] : undefined;
  };
  const filteredConversations = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase();

    if (!query) return conversations;

    return conversations.filter((conversation) => {
      const peerIdentityId = conversationPeerId(conversation);
      const searchable = [
        conversation.id,
        conversationName(conversation),
        conversationHandle(conversation),
        peerIdentityId ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [conversationSearch, conversations, identityNames, identityProfiles]);

  return (
    <aside className="glass-panel-strong flex h-full min-h-0 flex-col rounded-none p-4">
      <button
        onClick={onCreate}
        className="glass-button rounded-2xl bg-fuchsia-500 px-4 py-3 text-sm font-black shadow-xl shadow-fuchsia-950/20"
      >
        {copy.sidebar.createConversation}
      </button>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
        <SectionTitle title={copy.sidebar.oneToOneTitle} />
        <input
          value={conversationSearch}
          onChange={(event) => setConversationSearch(event.target.value)}
          className="mb-3 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-fuchsia-300/60"
          placeholder={copy.sidebar.searchConversations}
        />
        <div className="space-y-2">
          {filteredConversations.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
              {copy.sidebar.emptyConversations}
            </div>
          )}
          {filteredConversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => onSelect(conversation.id)}
              className={cx(
                'relative w-full overflow-hidden rounded-2xl p-3 text-left transition',
                activeConversationId === conversation.id
                  ? 'bg-white text-slate-950'
                  : 'bg-white/8 text-white hover:bg-white/14',
              )}
            >
              {conversationBannerUrls[conversation.id] && (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `linear-gradient(90deg, rgba(6,8,26,0) 0%, rgba(6,8,26,0) 50%, rgba(6,8,26,.62) 100%), url(${conversationBannerUrls[conversation.id]})`,
                    maskImage:
                      'linear-gradient(90deg, transparent 0%, transparent 42%, rgba(0,0,0,.18) 56%, rgba(0,0,0,.55) 72%, black 100%)',
                    WebkitMaskImage:
                      'linear-gradient(90deg, transparent 0%, transparent 42%, rgba(0,0,0,.18) 56%, rgba(0,0,0,.55) 72%, black 100%)',
                  }}
                />
              )}
              <div className="relative flex items-center gap-3">
                <div
                  className={cx(
                    'relative grid h-11 w-11 place-items-center overflow-visible rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-sm font-black text-slate-950',
                    activeConversationId === conversation.id &&
                      'ring-2 ring-slate-950/20',
                  )}
                >
                  <span className="absolute inset-0 grid place-items-center overflow-hidden rounded-2xl">
                    {conversationPicture(conversation) ? (
                      <img
                        src={conversationPicture(conversation)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      conversationName(conversation).slice(0, 1).toUpperCase()
                    )}
                  </span>
                  {conversationPeerId(conversation) && (
                    <PresenceStatusDot
                      presence={
                        presenceByIdentityId[conversationPeerId(conversation)!]
                      }
                      className="-bottom-1 -right-1"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-black">
                    {conversationName(conversation)}
                  </div>
                  <div
                    className={cx(
                      'truncate text-xs',
                      activeConversationId === conversation.id
                        ? 'text-slate-500'
                        : 'text-white/45',
                    )}
                  >
                    {conversationHandle(conversation)}
                  </div>
                </div>
                {!!conversation.unreadCount && (
                  <span className="rounded-full bg-fuchsia-500 px-2 py-1 text-xs font-black text-white">
                    {conversation.unreadCount}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      <UserProfileDropdown
        identityNames={identityNames}
        identityPictures={identityPictures}
        nodeNetworks={nodeNetworks}
        onLogout={onLogout}
        onPresenceChange={onPresenceChange}
        onPresenceStatusSelected={onPresenceStatusSelected}
        onSessionUpdated={onSessionUpdated}
        presence={presenceByIdentityId[session.identity.id]}
        session={session}
        activeCall={activeCall}
        onCallEnd={onCallEnd}
        onCallParticipantVolumeChange={onCallParticipantVolumeChange}
        onCallToggleCamera={onCallToggleCamera}
        onCallToggleDeafen={onCallToggleDeafen}
        onCallToggleMute={onCallToggleMute}
        onCallToggleScreenShare={onCallToggleScreenShare}
      />
    </aside>
  );
}

function filteredConversationPeerIdentityIds(
  conversations: ConversationResource[],
  currentIdentityId: string,
  keychain: Session['keychain'],
): Record<string, string> {
  return Object.fromEntries(
    conversations
      .map((conversation) => [
        conversation.id,
        conversationPeerIdentityId(conversation, currentIdentityId, keychain),
      ])
      .filter((entry): entry is [string, string] => !!entry[1]),
  );
}

function useIdentityBannerUrls(
  identities: Record<string, IdentityResource>,
  identityIdsByKey: Record<string, string>,
): Record<string, string> {
  const [bannerUrls, setBannerUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const entries = Object.entries(identityIdsByKey)
      .map(([key, identityId]) => [key, identities[identityId]] as const)
      .filter(
        (entry): entry is readonly [string, IdentityResource] =>
          !!entry[1]?.profile.banner && !bannerUrls[entry[0]],
      );

    if (entries.length === 0) return;

    let cancelled = false;

    void Promise.all(
      entries.map(async ([key, identity]) => {
        const directBanner = identityBanner(identity);

        if (directBanner) return [key, directBanner] as const;

        const bannerCid = identity.profile.banner?.trim();

        if (!bannerCid) return null;

        const loadedBanner = await loadPublicImage(bannerCid);

        return loadedBanner ? ([key, loadedBanner] as const) : null;
      }),
    )
      .then((loaded) => {
        if (cancelled) return;

        const nextUrls = loaded.filter(
          (entry): entry is readonly [string, string] => entry !== null,
        );

        if (nextUrls.length === 0) return;

        setBannerUrls((current) => ({
          ...current,
          ...Object.fromEntries(nextUrls),
        }));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [bannerUrls, identities, identityIdsByKey]);

  return bannerUrls;
}

function isGroupConversation(conversation: ConversationResource): boolean {
  return conversation.type === 'group' || conversation.id.startsWith('group:');
}

function conversationParticipants(
  conversation: ConversationResource,
): string[] {
  return (
    conversation.participantIdentityIds ??
    conversation.participantIds ??
    conversation.participants ??
    []
  );
}
