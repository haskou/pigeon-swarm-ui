import { EncryptedPayload, PublicKey } from '@haskou/value-objects';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import type { NodeNetwork } from '../../application/networks/ListNodeNetworks';
import type {
  Community,
  CommunityTextChannel,
  AttachmentProgress,
  ChatMessage,
  IdentityResource,
  MessageAttachment,
  MessageResource,
  Session,
} from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';
import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';
import { shortId } from '../../utils/formatting';
import {
  identityName,
  identityPicture,
  profilePictureDataUrl,
} from '../../utils/identityDisplay';
import { toUserErrorMessage } from '../../utils/toUserErrorMessage';
import { Field } from '../auth/Field';
import { Composer } from '../chat/Composer';
import { ImageLightbox } from '../chat/ImageLightbox';
import { MessageBubble } from '../chat/MessageBubble';
import { UserProfileDialog } from '../profile/UserProfileDialog';
import { LockIcon } from '../workspace/LockIcon';

interface CommunityWorkspaceProps {
  activeChannelId?: null | string;
  community: Community;
  mobileMembersOpen: boolean;
  mobileSidebarOpen: boolean;
  mobileRail?: ReactNode;
  nodeNetworks: NodeNetwork[];
  onChannelSelected: (channelId: string) => void;
  onCommunityUpdated: (community: Community) => void;
  onMobileMembersClose: () => void;
  onMobileSidebarClose: () => void;
  onOpenMobileSidebar: () => void;
  session: Session;
}

type MemberView = {
  identity?: IdentityResource;
  identityId: string;
  pictureUrl: null | string;
};

export function CommunityWorkspace({
  activeChannelId,
  community,
  mobileMembersOpen,
  mobileSidebarOpen,
  mobileRail,
  nodeNetworks,
  onChannelSelected,
  onCommunityUpdated,
  onMobileMembersClose,
  onMobileSidebarClose,
  onOpenMobileSidebar,
  session,
}: CommunityWorkspaceProps) {
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    activeChannelId ?? community.textChannels[0]?.id ?? null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageCursor, setMessageCursor] = useState<null | string>(null);
  const [messageState, setMessageState] = useState<
    'error' | 'idle' | 'loading'
  >('idle');
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [attachmentProgress, setAttachmentProgress] =
    useState<AttachmentProgress | null>(null);
  const [memberIdentities, setMemberIdentities] = useState<
    Record<string, IdentityResource>
  >({});
  const [memberPictures, setMemberPictures] = useState<Record<string, string>>(
    {},
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [bannerViewerOpen, setBannerViewerOpen] = useState(false);
  const [channelSearch, setChannelSearch] = useState('');
  const [manageOpen, setManageOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [profileViewer, setProfileViewer] = useState<MemberView | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const owner = community.ownerIdentityId === session.identity.id;
  const network =
    nodeNetworks.find((item) => item.id === community.networkId) ?? null;
  const networkName = network?.name ?? shortId(community.networkId);
  const selectedChannel = community.textChannels.find(
    (channel) => channel.id === selectedChannelId,
  );
  const channelEncryptionReady =
    !!selectedChannel &&
    community.memberIds.every(
      (identityId) => identityId === session.identity.id || memberIdentities[identityId],
    );
  const channelEncryptionTooltip = channelEncryptionReady
    ? copy.chat.e2eReady
    : copy.chat.e2eMissing;
  const members = useMemo<MemberView[]>(
    () =>
      community.memberIds.map((identityId) => ({
        identity: memberIdentities[identityId],
        identityId,
        pictureUrl: memberPictures[identityId] ?? null,
      })),
    [community.memberIds, memberIdentities, memberPictures],
  );
  const visibleChannels = useMemo(() => {
    const query = channelSearch.trim().toLowerCase();

    if (!query) return community.textChannels;

    return community.textChannels.filter((channel) =>
      channel.name.toLowerCase().includes(query),
    );
  }, [channelSearch, community.textChannels]);

  useEffect(() => {
    const nextSelectedChannel =
      community.textChannels.find((channel) => channel.id === activeChannelId)
        ?.id ??
      community.textChannels.find((channel) => channel.id === selectedChannelId)
        ?.id ??
      community.textChannels[0]?.id ??
      null;

    setSelectedChannelId(nextSelectedChannel);
    if (nextSelectedChannel) onChannelSelected(nextSelectedChannel);
  }, [
    activeChannelId,
    community.textChannels,
    onChannelSelected,
    selectedChannelId,
  ]);

  useEffect(() => {
    let cancelled = false;

    void Promise.all(
      community.memberIds.map(async (identityId) => {
        try {
          const identity = await pigeonApplication.getIdentity(identityId);
          const pictureUrl = await loadIdentityPicture(identity);

          return [identityId, identity, pictureUrl] as const;
        } catch {
          return [identityId, undefined, null] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;

      const nextIdentities: Record<string, IdentityResource> = {};
      const nextPictures: Record<string, string> = {};

      for (const [identityId, identity, pictureUrl] of entries) {
        if (identity) nextIdentities[identityId] = identity;
        if (pictureUrl) nextPictures[identityId] = pictureUrl;
      }

      setMemberIdentities(nextIdentities);
      setMemberPictures(nextPictures);
    });

    return () => {
      cancelled = true;
    };
  }, [community.memberIds]);

  useEffect(() => {
    const avatar = community.avatar?.trim();

    setAvatarUrl(null);
    if (!avatar) return undefined;

    let cancelled = false;

    void loadPublicImage(avatar).then((url) => {
      if (!cancelled) setAvatarUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [community.avatar]);

  useEffect(() => {
    const banner = community.banner?.trim();

    setBannerUrl(null);
    setBannerViewerOpen(false);
    if (!banner) return undefined;

    let cancelled = false;

    void loadPublicImage(banner).then((url) => {
      if (!cancelled) setBannerUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [community.banner]);

  const refreshCommunity = async () => {
    onCommunityUpdated(await pigeonApplication.getCommunity(session, community.id));
  };

  const resolveMemberIdentities = useCallback(async () => {
    const entries = await Promise.all(
      community.memberIds.map(async (identityId) => {
        const cached =
          identityId === session.identity.id
            ? session.identity
            : memberIdentities[identityId];

        if (cached) return [identityId, cached] as const;

        try {
          return [identityId, await pigeonApplication.getIdentity(identityId)] as const;
        } catch {
          return [identityId, undefined] as const;
        }
      }),
    );
    const nextIdentities: Record<string, IdentityResource> = {};

    for (const [identityId, identity] of entries) {
      if (identity) nextIdentities[identityId] = identity;
    }

    return nextIdentities;
  }, [community.memberIds, memberIdentities, session.identity]);

  const projectChannelMessage = useCallback(
    async (
      rawMessage: MessageResource,
      identities: Record<string, IdentityResource>,
    ): Promise<ChatMessage> => {
      const base = {
        attachments: [],
        authorIdentityId: rawMessage.authorIdentityId ?? 'unknown',
        id: rawMessage.id ?? `${rawMessage.createdAt ?? Date.now()}`,
        mine: rawMessage.authorIdentityId === session.identity.id,
        raw: rawMessage,
        timestamp: rawMessage.createdAt ?? Date.now(),
      };

      try {
        const payload = await decryptCommunityChannelPayload(
          session,
          rawMessage.encryptedPayload ?? '',
        );

        return {
          ...base,
          attachments: payload.attachments ?? [],
          authorIdentityId: payload.authorIdentityId ?? base.authorIdentityId,
          content: payload.content ?? '',
          encrypted: false,
          mine:
            (payload.authorIdentityId ?? base.authorIdentityId) ===
            session.identity.id,
          timestamp: payload.timestamp ?? base.timestamp,
        };
      } catch {
        return {
          ...base,
          authorIdentityId:
            rawMessage.authorIdentityId ??
            identities[rawMessage.authorIdentityId ?? '']?.id ??
            'unknown',
          content: copy.messages.decryptFailed,
          encrypted: true,
        };
      }
    },
    [session],
  );

  const loadChannelMessages = useCallback(
    async (channelId: string, beforeMessageId?: string) => {
      const [identities, result] = await Promise.all([
        resolveMemberIdentities(),
        pigeonApplication.listCommunityChannelMessages(
          session,
          community.id,
          channelId,
          { beforeMessageId },
        ),
      ]);
      const loadedMessages = await Promise.all(
        result.messages.map((message) => projectChannelMessage(message, identities)),
      );

      return {
        cursor: result.nextBeforeMessageId ?? null,
        loadedMessages,
      };
    },
    [community.id, projectChannelMessage, resolveMemberIdentities, session],
  );

  const handleMessagesScroll = () => {
    const scroller = scrollerRef.current;

    if (!scroller || scroller.scrollTop > 80 || !messageCursor) return;
    if (messageState === 'loading' || !selectedChannelId) return;

    const previousHeight = scroller.scrollHeight;

    setMessageState('loading');
    void loadChannelMessages(selectedChannelId, messageCursor)
      .then(({ cursor, loadedMessages }) => {
        setMessages((current) => [...loadedMessages, ...current]);
        setMessageCursor(cursor);
        requestAnimationFrame(() => {
          if (!scrollerRef.current) return;
          scrollerRef.current.scrollTop =
            scrollerRef.current.scrollHeight - previousHeight;
        });
      })
      .catch(() => setMessageState('error'))
      .finally(() => setMessageState('idle'));
  };

  const handleSendChannelMessage = async (
    content: string,
    attachments: File[],
  ) => {
    if (!selectedChannelId) return;

    setSendError(null);
    const timestamp = Date.now();

    try {
      const identities = await resolveMemberIdentities();
      const messageAttachments = await pigeonApplication.publishMessageAttachments(
        session,
        attachments,
        setAttachmentProgress,
      );
      const encryptedPayload = await encryptCommunityChannelPayload({
        attachments: messageAttachments,
        authorIdentityId: session.identity.id,
        channelId: selectedChannelId,
        communityId: community.id,
        content,
        recipients: Object.values(identities),
        timestamp,
      });
      const created = await pigeonApplication.createCommunityChannelMessage(
        session,
        community.id,
        selectedChannelId,
        {
          attachmentExternalIdentifiers: messageAttachments.map(
            (attachment) => attachment.cid,
          ),
          encryptedPayload,
          timestamp,
        },
      );
      const projected = await projectChannelMessage(created, identities);

      setMessages((current) => [...current, projected]);
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ block: 'end' });
      });
    } catch (caught) {
      setSendError(toUserErrorMessage(caught, copy.communities.messageError));
    } finally {
      setAttachmentProgress(null);
    }
  };

  const loadAttachmentPreview = useCallback(
    async (
      attachment: MessageAttachment,
      onProgress?: (progress: AttachmentProgress) => void,
    ): Promise<string> => {
      const blob = await pigeonApplication.downloadAttachment(
        attachment,
        onProgress,
      );

      return URL.createObjectURL(blob);
    },
    [],
  );

  const openAttachment = async (attachment?: MessageAttachment) => {
    if (!attachment) return;

    try {
      const url = await loadAttachmentPreview(attachment);
      const link = document.createElement('a');

      link.href = url;
      link.download = attachment.filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      setSendError(copy.composer.attachmentDownloadError);
    }
  };

  useEffect(() => {
    if (!selectedChannelId) {
      setMessages([]);
      setMessageCursor(null);
      setMessageState('idle');

      return undefined;
    }

    let cancelled = false;

    setMessageState('loading');
    setSendError(null);
    void loadChannelMessages(selectedChannelId)
      .then(({ cursor, loadedMessages }) => {
        if (cancelled) return;
        setMessages(loadedMessages);
        setMessageCursor(cursor);
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ block: 'end' });
        });
      })
      .catch(() => {
        if (!cancelled) setMessageState('error');
      })
      .finally(() => {
        if (!cancelled) setMessageState('idle');
      });

    return () => {
      cancelled = true;
    };
  }, [loadChannelMessages, selectedChannelId]);

  return (
    <>
      {mobileSidebarOpen && (
        <button
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onMobileSidebarClose}
          aria-label={copy.workspace.closeSidebar}
        />
      )}
      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-40 w-[calc(100vw-1.5rem)] max-w-[442px] p-3 transition sm:w-[calc(86vw+82px)] lg:static lg:z-auto lg:block lg:w-auto lg:max-w-none lg:p-0',
          mobileSidebarOpen ? 'block' : 'hidden lg:block',
        )}
      >
        <div className="grid h-full grid-cols-[82px_minmax(0,1fr)] gap-3 lg:block">
          <div className="lg:hidden">{mobileRail}</div>
          <div className="glass-panel-strong flex h-full min-h-0 flex-col rounded-none p-4 sm:rounded-[2rem]">
            <div className="min-w-0">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-white/35">
                {copy.communities.privateCommunity}
              </div>
              <div className="mt-3 overflow-hidden rounded-3xl bg-white/8 text-left">
                {bannerUrl ? (
                  <button
                    type="button"
                    onClick={() => setBannerViewerOpen(true)}
                    className="grid h-32 w-full place-items-center overflow-hidden bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-5xl font-black text-slate-950 transition hover:brightness-110"
                    aria-label={copy.communities.openBanner}
                  >
                    <img
                      src={bannerUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                ) : (
                  <div className="grid h-32 place-items-center overflow-hidden bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-5xl font-black text-slate-950">
                    {community.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="p-4">
                  <h2 className="truncate text-xl font-black">{community.name}</h2>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-white/55">
                    {community.description}
                  </p>
                </div>
              </div>
              {owner && (
                <button
                  type="button"
                  onClick={() => setManageOpen(true)}
                  className="mt-3 w-full rounded-2xl bg-fuchsia-500 px-4 py-3 text-sm font-black text-white shadow-xl shadow-fuchsia-950/20 transition hover:bg-fuchsia-400"
                >
                  {copy.communities.manage}
                </button>
              )}
            </div>

            <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-white/35">
                {copy.communities.channels}
              </div>
              <input
                value={channelSearch}
                onChange={(event) => setChannelSearch(event.target.value)}
                className="mb-3 w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                placeholder={copy.communities.searchChannels}
              />
              <div className="space-y-2">
                {community.textChannels.length === 0 ? (
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
                    {copy.communities.noChannels}
                  </div>
                ) : visibleChannels.length === 0 ? (
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
                    {copy.communities.noMatchingChannels}
                  </div>
                ) : (
                  visibleChannels.map((channel) => (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => {
                        setSelectedChannelId(channel.id);
                        onChannelSelected(channel.id);
                        onMobileSidebarClose();
                      }}
                      className={cx(
                        'flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm font-black transition',
                        selectedChannelId === channel.id
                          ? 'bg-white text-slate-950'
                          : 'bg-white/8 text-white hover:bg-white/14',
                      )}
                    >
                      <span className="truncate">#{channel.name}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>

      <section className="glass-panel-strong flex min-h-0 flex-col overflow-hidden rounded-none sm:rounded-[2rem]">
        <header className="border-b border-white/10 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenMobileSidebar}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10 text-white lg:hidden"
              aria-label={copy.chat.menu}
            >
              ☰
            </button>
            <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 font-black text-slate-950">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                community.name.slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="truncate text-2xl font-black">
                  {selectedChannel
                    ? `# ${selectedChannel.name}`
                    : community.name}
                </h1>
                <span
                  className={
                    channelEncryptionReady
                      ? 'shrink-0 text-emerald-300'
                      : 'shrink-0 text-rose-300'
                  }
                  title={channelEncryptionTooltip}
                  aria-label={channelEncryptionTooltip}
                >
                  <LockIcon locked={channelEncryptionReady} />
                </span>
              </div>
              {selectedChannel ? (
                <p className="truncate text-sm text-white/50">
                  {copy.communities.channelMetadataOnly}{' '}
                  <span title={community.networkId}>{networkName}</span>
                </p>
              ) : (
                <p className="truncate text-sm text-white/50">
                  {community.description}
                </p>
              )}
            </div>
          </div>
        </header>

        {!selectedChannel ? (
          <div className="grid flex-1 place-items-center p-6 text-center">
            <div className="max-w-md">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white/10 text-3xl font-black">
                #
              </div>
              <h2 className="mt-5 text-2xl font-black">
                {copy.communities.noChannelSelected}
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/55">
                {copy.communities.noChannelSelectedBody}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div
              ref={scrollerRef}
              onScroll={handleMessagesScroll}
              className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"
            >
              {messageState === 'loading' && (
                <div className="mx-auto mb-4 w-fit rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white/60">
                  {copy.chat.loadingEvents}
                </div>
              )}
              <div className="space-y-2">
                {!messageCursor &&
                  messages.length > 0 &&
                  messageState !== 'loading' && (
                    <div className="mx-auto w-fit rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white/35">
                      {copy.chat.noMoreMessages}
                    </div>
                  )}
                {messages.map((message, index) => {
                  const nextMessage = messages[index + 1];
                  const showAvatar =
                    !nextMessage ||
                    nextMessage.authorIdentityId !== message.authorIdentityId;

                  return (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      currentIdentityId={session.identity.id}
                      authorName={
                        message.mine
                          ? session.identity.profile.name
                          : memberDisplayName(
                              memberIdentities[message.authorIdentityId],
                              message.authorIdentityId,
                            )
                      }
                      authorPicture={
                        message.mine
                          ? memberPictures[session.identity.id]
                          : memberPictures[message.authorIdentityId]
                      }
                      onAttachmentOpen={(attachmentIndex) =>
                        void openAttachment(message.attachments[attachmentIndex])
                      }
                      onAttachmentPreview={loadAttachmentPreview}
                      onAvatarClick={() => undefined}
                      onMessageMenuOpen={() => undefined}
                      onReplyReferenceClick={() => undefined}
                      showAvatar={showAvatar}
                    />
                  );
                })}
                {messages.length === 0 && messageState !== 'loading' && (
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-5 text-center text-sm text-white/55">
                    {copy.communities.emptyChannel}
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </div>
            <Composer
              disabled={messageState === 'loading'}
              draft={draft}
              error={sendError}
              onDraftChange={setDraft}
              onEscape={() => undefined}
              onSend={handleSendChannelMessage}
              progress={attachmentProgress}
            />
          </>
        )}
      </section>

      <aside className="glass-panel hidden h-full min-h-0 overflow-y-auto rounded-[2rem] p-4 xl:block">
        <button
          type="button"
          onClick={() => setMemberOpen(true)}
          className="mb-4 w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15"
        >
          {copy.communities.addMember}
        </button>
        <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-white/35">
          {copy.communities.members}
        </div>
        <div className="space-y-2">
          {members.map((member) => (
            <MemberRow
              key={member.identityId}
              identity={member.identity}
              identityId={member.identityId}
              onClick={() => setProfileViewer(member)}
              owner={member.identityId === community.ownerIdentityId}
              pictureUrl={member.pictureUrl}
            />
          ))}
        </div>
      </aside>

      {mobileMembersOpen && (
        <>
          <button
            className="fixed inset-0 z-40 bg-black/50 xl:hidden"
            onClick={onMobileMembersClose}
            aria-label={copy.dialog.close}
          />
          <aside className="glass-panel fixed inset-y-0 right-0 z-50 w-[86vw] max-w-[360px] overflow-y-auto rounded-none p-4 xl:hidden">
            <button
              type="button"
              onClick={() => setMemberOpen(true)}
              className="mb-4 w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15"
            >
              {copy.communities.addMember}
            </button>
            <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-white/35">
              {copy.communities.members}
            </div>
            <div className="space-y-2">
              {members.map((member) => (
                <MemberRow
                  key={member.identityId}
                  identity={member.identity}
                  identityId={member.identityId}
                  onClick={() => setProfileViewer(member)}
                  owner={member.identityId === community.ownerIdentityId}
                  pictureUrl={member.pictureUrl}
                />
              ))}
            </div>
          </aside>
        </>
      )}

      {bannerViewerOpen && bannerUrl && (
        <ImageLightbox
          images={[
            {
              alt: community.name,
              filename: community.banner ?? community.name,
              url: bannerUrl,
            },
          ]}
          initialIndex={0}
          onClose={() => setBannerViewerOpen(false)}
        />
      )}
      {manageOpen && (
        <ManageCommunityDialog
          community={community}
          onClose={() => setManageOpen(false)}
          onCommunityUpdated={onCommunityUpdated}
          refreshCommunity={refreshCommunity}
          session={session}
        />
      )}
      {memberOpen && (
        <AddCommunityMemberDialog
          communityId={community.id}
          onClose={() => setMemberOpen(false)}
          refreshCommunity={refreshCommunity}
          session={session}
        />
      )}
      {profileViewer && (
        <UserProfileDialog
          identity={profileViewer.identity}
          identityId={profileViewer.identityId}
          name={memberDisplayName(profileViewer.identity, profileViewer.identityId)}
          nodeNetworks={nodeNetworks}
          onClose={() => setProfileViewer(null)}
          picture={profileViewer.pictureUrl}
        />
      )}
    </>
  );
}

function ManageCommunityDialog({
  community,
  onClose,
  onCommunityUpdated,
  refreshCommunity,
  session,
}: {
  community: Community;
  onClose: () => void;
  onCommunityUpdated: (community: Community) => void;
  refreshCommunity: () => Promise<void>;
  session: Session;
}) {
  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
  const [currentBannerUrl, setCurrentBannerUrl] = useState<string | null>(null);
  const [channelName, setChannelName] = useState('');
  const [renamingChannelId, setRenamingChannelId] = useState<string | null>(null);
  const [channelDrafts, setChannelDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      community.textChannels.map((channel) => [channel.id, channel.name]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading'>('idle');

  useEffect(() => {
    if (!avatar) {
      setAvatarPreview(null);

      return undefined;
    }

    const nextPreview = URL.createObjectURL(avatar);

    setAvatarPreview(nextPreview);

    return () => URL.revokeObjectURL(nextPreview);
  }, [avatar]);

  useEffect(() => {
    if (!banner) {
      setBannerPreview(null);

      return undefined;
    }

    const nextPreview = URL.createObjectURL(banner);

    setBannerPreview(nextPreview);

    return () => URL.revokeObjectURL(nextPreview);
  }, [banner]);

  useEffect(() => {
    let cancelled = false;

    setCurrentAvatarUrl(null);
    if (!community.avatar) return undefined;

    void loadPublicImage(community.avatar).then((url) => {
      if (!cancelled) setCurrentAvatarUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [community.avatar]);

  useEffect(() => {
    let cancelled = false;

    setCurrentBannerUrl(null);
    if (!community.banner) return undefined;

    void loadPublicImage(community.banner).then((url) => {
      if (!cancelled) setCurrentBannerUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [community.banner]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const saveProfile = async (): Promise<boolean> => {
    if (state === 'loading') return false;

    setState('loading');
    setError(null);
    try {
      const updated = await pigeonApplication.updateCommunity(
        session,
        community.id,
        {
          ...(avatar ? { avatar } : {}),
          ...(banner ? { banner } : {}),
          description: description.trim(),
          name: name.trim(),
        },
      );

      onCommunityUpdated(updated);
      return true;
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.communities.updateError));
      return false;
    } finally {
      setState('idle');
    }
  };

  const finishManage = async () => {
    const saved = await saveProfile();

    if (!saved) return;
    await refreshCommunity();
    onClose();
  };

  const createChannel = async () => {
    const nextName = channelName.trim();

    if (!nextName || state === 'loading') return;

    setState('loading');
    setError(null);
    try {
      const channel = await pigeonApplication.createCommunityTextChannel(
        session,
        community.id,
        nextName,
      );

      setChannelName('');
      onCommunityUpdated({
        ...community,
        textChannels: [...community.textChannels, channel],
      });
      setChannelDrafts((current) => ({ ...current, [channel.id]: channel.name }));
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.communities.channelError));
    }
    setState('idle');
  };

  const renameChannel = async (channel: CommunityTextChannel) => {
    const nextName = channelDrafts[channel.id]?.trim();

    if (!nextName || nextName === channel.name || state === 'loading') return;

    setRenamingChannelId(channel.id);
    setState('loading');
    setError(null);
    try {
      const updated = await pigeonApplication.renameCommunityChannel(
        session,
        community.id,
        channel.id,
        nextName,
      );

      onCommunityUpdated({
        ...community,
        textChannels: community.textChannels.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      });
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.communities.channelError));
    }
    setRenamingChannelId(null);
    setState('idle');
  };

  const moveChannel = (channelId: string, direction: -1 | 1) => {
    const index = community.textChannels.findIndex(
      (channel) => channel.id === channelId,
    );
    const nextIndex = index + direction;

    if (index < 0 || nextIndex < 0 || nextIndex >= community.textChannels.length)
      return;

    const nextChannels = [...community.textChannels];
    const [channel] = nextChannels.splice(index, 1);

    nextChannels.splice(nextIndex, 0, channel);
    onCommunityUpdated({ ...community, textChannels: nextChannels });
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-stretch bg-black/60 p-0 backdrop-blur-md sm:place-items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <section className="glass-panel-strong relative z-10 flex max-h-screen w-full flex-col overflow-hidden rounded-none p-5 shadow-2xl shadow-black/40 sm:max-h-[88vh] sm:max-w-2xl sm:rounded-[2rem]">
        <DialogHeader title={copy.communities.manage} onClose={onClose} />
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-white/35">
                {copy.communities.avatar}
              </span>
              <div className="mx-auto grid h-28 w-28 cursor-pointer place-items-center overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-4xl font-black text-slate-950">
                {avatarPreview || currentAvatarUrl ? (
                  <img
                    src={avatarPreview ?? currentAvatarUrl ?? ''}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  community.name.slice(0, 1).toUpperCase()
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setAvatar(event.target.files?.[0] ?? null)}
                className="mt-3 w-full text-xs text-white/55 file:mr-3 file:rounded-2xl file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-black file:text-slate-950"
              />
            </label>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-white/35">
                  {copy.communities.banner}
                </span>
                <div className="grid h-28 cursor-pointer place-items-center overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-4xl font-black text-slate-950">
                  {bannerPreview || currentBannerUrl ? (
                    <img
                      src={bannerPreview ?? currentBannerUrl ?? ''}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    community.name.slice(0, 1).toUpperCase()
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setBanner(event.target.files?.[0] ?? null)}
                  className="mt-3 w-full text-xs text-white/55 file:mr-3 file:rounded-2xl file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-black file:text-slate-950"
                />
              </label>
              <Field label={copy.communities.name}>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                />
              </Field>
              <Field label={copy.communities.description}>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                />
              </Field>
            </div>
          </div>

          <div className="mt-6 border-t border-white/10 pt-5">
            <div className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-white/35">
              {copy.communities.channels}
            </div>
            <div className="flex gap-2">
              <input
                value={channelName}
                onChange={(event) => setChannelName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  void createChannel();
                }}
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                placeholder="general"
              />
              <button
                type="button"
                onClick={() => void createChannel()}
                disabled={!channelName.trim() || state === 'loading'}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45"
              >
                +
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {community.textChannels.map((channel, index) => (
                <div
                  key={channel.id}
                  className="flex items-center gap-2 rounded-2xl bg-white/8 p-2"
                >
                  <span className="px-2 text-white/45">#</span>
                  <input
                    value={channelDrafts[channel.id] ?? channel.name}
                    onChange={(event) =>
                      setChannelDrafts((current) => ({
                        ...current,
                        [channel.id]: event.target.value,
                      }))
                    }
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60"
                  />
                  <button
                    type="button"
                    onClick={() => moveChannel(channel.id, -1)}
                    disabled={index === 0}
                    className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 font-black disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label={copy.communities.moveChannelUp}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveChannel(channel.id, 1)}
                    disabled={index === community.textChannels.length - 1}
                    className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 font-black disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label={copy.communities.moveChannelDown}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => void renameChannel(channel)}
                    disabled={
                      state === 'loading' ||
                      renamingChannelId === channel.id ||
                      !channelDrafts[channel.id]?.trim()
                    }
                    className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {copy.profile.save}
                  </button>
                </div>
              ))}
            </div>
          </div>
          {error && (
            <div className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-3 text-xs text-rose-100">
              {error}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => void finishManage()}
          disabled={!name.trim() || state === 'loading'}
          className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {copy.communities.done}
        </button>
      </section>
    </div>,
    document.body,
  );
}

function AddCommunityMemberDialog({
  communityId,
  onClose,
  refreshCommunity,
  session,
}: {
  communityId: string;
  onClose: () => void;
  refreshCommunity: () => Promise<void>;
  session: Session;
}) {
  const [identityInput, setIdentityInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading'>('idle');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const addMember = async () => {
    const identityId = normalizeIdentityLookup(identityInput);

    if (!identityId || state === 'loading') return;

    setState('loading');
    setError(null);
    try {
      await pigeonApplication.addCommunityMember(session, communityId, identityId);
      await refreshCommunity();
      onClose();
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.communities.memberError));
    }
    setState('idle');
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-stretch bg-black/60 p-0 backdrop-blur-md sm:place-items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <section className="glass-panel-strong relative z-10 w-full rounded-none p-5 shadow-2xl shadow-black/40 sm:max-w-md sm:rounded-[2rem]">
        <DialogHeader title={copy.communities.addMember} onClose={onClose} />
        <Field label={copy.communities.memberIdentity}>
          <input
            autoFocus
            value={identityInput}
            onChange={(event) => setIdentityInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              void addMember();
            }}
            className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
            placeholder="@ada or identity id"
          />
        </Field>
        {error && (
          <div className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-3 text-xs text-rose-100">
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={() => void addMember()}
          disabled={!identityInput.trim() || state === 'loading'}
          className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {copy.communities.addMember}
        </button>
      </section>
    </div>,
    document.body,
  );
}

function DialogHeader({
  onClose,
  title,
}: {
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <h2 className="text-2xl font-black tracking-tight">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-xl font-black text-white/70 transition hover:bg-white/15"
        aria-label={copy.dialog.close}
      >
        ×
      </button>
    </div>
  );
}

function MemberRow({
  identity,
  identityId,
  onClick,
  owner,
  pictureUrl,
}: {
  identity?: IdentityResource;
  identityId: string;
  onClick: () => void;
  owner: boolean;
  pictureUrl: null | string;
}) {
  const name = memberPrimaryName(identity, identityId);
  const handle = identity?.profile.handle?.trim();

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex w-full items-center gap-3 rounded-2xl bg-white/8 p-3 text-left transition hover:bg-white/12"
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 font-black text-slate-950">
        {pictureUrl ? (
          <img src={pictureUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          name.slice(0, 1).toUpperCase()
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-black">{name}</div>
        <div className="truncate text-xs text-white/45">
          {handle ? `@${handle}` : shortId(identityId)}
        </div>
      </div>
      {owner && (
        <span
          className="absolute right-2 top-2 text-sm text-yellow-300"
          title={copy.communities.owner}
        >
          ♛
        </span>
      )}
    </button>
  );
}

function normalizeIdentityLookup(value: string): string {
  const trimmed = value.trim();

  return trimmed.startsWith('@') ? trimmed.slice(1).toLowerCase() : trimmed;
}

async function loadIdentityPicture(
  identity: IdentityResource,
): Promise<string | null> {
  const directPicture = identityPicture(identity);

  if (directPicture) return directPicture;

  const pictureCid = identity.profile.picture?.trim();

  if (!pictureCid) return null;

  try {
    return await loadPublicImage(pictureCid);
  } catch {
    return null;
  }
}

async function loadPublicImage(cid: string): Promise<string | null> {
  try {
    const content = await pigeonApplication.getPublicFile(cid);

    return profilePictureDataUrl(content);
  } catch {
    return null;
  }
}

function memberDisplayName(
  identity: IdentityResource | undefined,
  identityId: string,
): string {
  return identity ? (identityName(identity) ?? shortId(identity.id)) : shortId(identityId);
}

function memberPrimaryName(
  identity: IdentityResource | undefined,
  identityId: string,
): string {
  const name = identity?.profile.name.trim();

  if (name) return name;

  const handle = identity?.profile.handle?.trim();

  return handle ? `@${handle}` : shortId(identityId);
}

type CommunityChannelPlainPayload = {
  attachments?: MessageAttachment[];
  authorIdentityId?: string;
  channelId?: string;
  communityId?: string;
  content?: string;
  timestamp?: number;
  type?: string;
};

type CommunityChannelEnvelope = {
  algorithm: 'community-channel.v1';
  ciphertext: string;
  iv: string;
  recipients: Record<string, string>;
};

async function encryptCommunityChannelPayload(input: {
  attachments: MessageAttachment[];
  authorIdentityId: string;
  channelId: string;
  communityId: string;
  content: string;
  recipients: IdentityResource[];
  timestamp: number;
}): Promise<string> {
  const key = await crypto.subtle.generateKey(
    { length: 256, name: 'AES-GCM' },
    true,
    ['decrypt', 'encrypt'],
  );
  const rawKey = await crypto.subtle.exportKey('raw', key);
  const rawKeyBase64 = bytesToBase64(new Uint8Array(rawKey));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(
    JSON.stringify({
      attachments: input.attachments,
      authorIdentityId: input.authorIdentityId,
      channelId: input.channelId,
      communityId: input.communityId,
      content: input.content,
      timestamp: input.timestamp,
      type: 'CommunityChannelMessageSent',
    }),
  );
  const encrypted = await crypto.subtle.encrypt({ iv, name: 'AES-GCM' }, key, plaintext);
  const recipients: Record<string, string> = {};

  for (const identity of input.recipients) {
    recipients[identity.id] = PublicKey.fromPEM(
      identity.encryptedKeyPair.publicKey,
    )
      .encrypt(rawKeyBase64)
      .toString();
  }

  return JSON.stringify({
    algorithm: 'community-channel.v1',
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
    recipients,
  } satisfies CommunityChannelEnvelope);
}

async function decryptCommunityChannelPayload(
  session: Session,
  encryptedPayload: string,
): Promise<CommunityChannelPlainPayload> {
  const envelope = JSON.parse(encryptedPayload) as CommunityChannelEnvelope;
  const wrappedKey = envelope.recipients[session.identity.id];

  if (!wrappedKey) {
    throw new Error(copy.messages.missingKey);
  }

  const rawKey = await session.encryptedKeyPair.decrypt(
    new EncryptedPayload(wrappedKey),
    session.password,
  );
  const key = await crypto.subtle.importKey(
    'raw',
    bytesToArrayBuffer(base64ToBytes(rawKey.toString())),
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );
  const decrypted = await crypto.subtle.decrypt(
    { iv: bytesToArrayBuffer(base64ToBytes(envelope.iv)), name: 'AES-GCM' },
    key,
    bytesToArrayBuffer(base64ToBytes(envelope.ciphertext)),
  );

  return JSON.parse(new TextDecoder().decode(decrypted)) as CommunityChannelPlainPayload;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copyBytes = new Uint8Array(bytes.byteLength);

  copyBytes.set(bytes);

  return copyBytes.buffer;
}
