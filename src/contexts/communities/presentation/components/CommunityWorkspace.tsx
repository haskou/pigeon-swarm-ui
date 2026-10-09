import { useCallback, useEffect, useMemo, useState } from 'react';

import type { MessageContextMenuState } from '../../../../app/presentation/workspace/components/messageContextMenu';
import type {
  ChatMessage,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';
import type { CommunityWorkspaceProps } from './CommunityWorkspaceProps';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { shortId } from '../../../../shared/presentation/formatting';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { profileAnchorFromTarget } from '../../../identities/presentation/view-models/profilePopoverAnchor';
import { NotificationSettingsPolicy } from '../../../notifications/presentation/view-models/NotificationSettingsPolicy';
import { CommunityChannelEncryption } from '../view-models/CommunityChannelEncryption';
import { CommunityEncryptionDetails } from '../view-models/CommunityEncryptionDetails';
import { CommunityConversation } from './CommunityConversation';
import { memberDisplayName } from './communityMemberNames';
import { CommunityMembersPanel } from './communityMembersPanel';
import { communityMessageIdentityIds } from './communityMessageIdentityIds';
import { communityMessageMenuActions } from './communityMessageMenuActions';
import { CommunityMessageSearchPanel } from './CommunityMessageSearchPanel';
import { CommunityNoChannelSelected } from './CommunityNoChannelSelected';
import { CommunityPinnedMessagesDialog } from './CommunityPinnedMessagesDialog';
import { CommunitySidebar } from './CommunitySidebar';
import { type CommunityThreadState } from './communityThreadState';
import { CommunityThreadPane } from './CommunityThreadPane';
import { CommunityWorkspaceDialogs } from './CommunityWorkspaceDialogs';
import { CommunityWorkspaceHeader } from './CommunityWorkspaceHeader';
import { mergeChatMessages } from './communityWorkspaceHelpers';
import { useCommunityChannelAccess } from './useCommunityChannelAccess';
import { useCommunityEncryption } from './useCommunityEncryption';
import { useCommunityChannelMessages } from './useCommunityChannelMessages';
import { useCommunityChannelPolls } from './useCommunityChannelPolls';
import { useCommunityChannelRealtime } from './useCommunityChannelRealtime';
import { useCommunityChannelThreads } from './useCommunityChannelThreads';
import { useCommunityDrafts } from './useCommunityDrafts';
import { useCommunityLeave } from './useCommunityLeave';
import { useCommunityMembers } from './useCommunityMembers';
import { useCommunityMentions } from './useCommunityMentions';
import { useCommunityMessageComposer } from './useCommunityMessageComposer';
import { useCommunityMessageFocus } from './useCommunityMessageFocus';
import { useCommunityMessageProjection } from './useCommunityMessageProjection';
import { useCommunityMessageSearch } from './useCommunityMessageSearch';
import { useCommunityPinnedMessages } from './useCommunityPinnedMessages';
import { useCommunityPollWorkflow } from './useCommunityPollWorkflow';
import { useCommunityProfileViewer } from './useCommunityProfileViewer';
import { useCommunityRefresh } from './useCommunityRefresh';
import { useCommunityThreadActions } from './useCommunityThreadActions';
import { useCommunityThreadLabels } from './useCommunityThreadLabels';
import { useCommunityThreadNavigation } from './useCommunityThreadNavigation';
import { useCommunityVisibleChannels } from './useCommunityVisibleChannels';
import { useCommunityVisualAssets } from './useCommunityVisualAssets';

export function CommunityWorkspace({
  activeCall,
  activeChannelId,
  animateSidePanelEntries = true,
  channelUnreadCounts = {},
  community,
  invitationAccepting = false,
  invitationError,
  invitationInviterName,
  mobileMembersOpen,
  mobileRail,
  mobileSidebarOpen,
  nodeNetworks,
  notificationSettingsByScopeKey,
  onCallEnd,
  onCallParticipantScreenShareVolumeChange,
  onCallParticipantVolumeChange,
  onCallRetryMicrophone,
  onCallRetryConnection,
  onCallScreenShareQualityChange,
  onCallToggleCamera,
  onCallToggleDeafen,
  onCallToggleMediaEncryption,
  onCallToggleMute,
  onCallToggleNoiseCancellation,
  onCallToggleScreenShare,
  onChannelSelected,
  onChannelViewed,
  onCommunityChannelsUpdated,
  onCommunityLeft,
  onCommunityUpdated,
  onInvitationAccept,
  onJoinVoiceChannel,
  onLogout,
  onMobileMembersClose,
  onMobileSidebarClose,
  onNotificationMuteToggle,
  onNotificationSettingsOpen,
  onOpenConversationWithIdentity,
  onOpenMobileSidebar,
  onPresenceChange,
  onPresenceStatusSelected,
  onRealtimeEventsOpen,
  onSessionUpdated,
  onTypingActive,
  pendingInvitation,
  presenceByIdentityId = {},
  realtimeEvent,
  realtimeStatus = 'connected',
  session,
  timelineFocusKey,
  typingIdentityIds = [],
}: CommunityWorkspaceProps) {
  const {
    accessibleTextChannels,
    accessibleVoiceChannels,
    channelNotificationScope,
    channelNotificationSetting,
    channelTopologyKey,
    communityNotificationScope,
    communityNotificationSetting,
    currentPermissions,
    currentRoleIds,
    resolvedChannelId,
    textChannels,
    voiceChannels,
  } = useCommunityChannelAccess({
    activeChannelId,
    community,
    currentIdentityId: session.identity.id,
    notificationSettingsByScopeKey,
  });
  const [stickerPackPreview, setStickerPackPreview] =
    useState<StickerMessageReference | null>(null);
  const communityVisualAssets = useCommunityVisualAssets(community);
  const { avatarUrl, avatarViewerOpen, bannerUrl, bannerViewerOpen } =
    communityVisualAssets;
  const [communityDataOpen, setCommunityDataOpen] = useState(false);
  const [encryptionDetailsOpen, setEncryptionDetailsOpen] = useState(false);
  const [communityMenuOpen, setCommunityMenuOpen] = useState(false);
  const [channelSearch, setChannelSearch] = useState('');
  const [manageOpen, setManageOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [messageContextMenu, setMessageContextMenu] =
    useState<MessageContextMenuState | null>(null);
  const [rawMessage, setRawMessage] = useState<ChatMessage | null>(null);
  const [threadPanel, setThreadPanel] = useState<CommunityThreadState | null>(
    null,
  );
  const [pollDialogOpen, setPollDialogOpen] = useState(false);

  useCloseOnEscape(onMobileSidebarClose, mobileSidebarOpen);
  const communityIsPublic = community.visibility === 'public';
  const encryptionState = useCommunityEncryption({
    communityId: community.id,
    isPublic: communityIsPublic,
    memberKey: community.memberIds.join(','),
    session,
  });
  const { loadChannelMessages, projectChannelMessage, projectChannelMessages } =
    useCommunityMessageProjection({
      communityId: community.id,
      session,
    });
  const channelMessages = useCommunityChannelMessages({
    loadChannelMessages,
    onChannelSelected,
    onChannelViewed,
    onMobileSidebarClose,
    resolvedChannelId,
    timelineFocusKey,
  });
  const {
    handleChannelSelected,
    incrementNewChannelMessageCount,
    isScrolledNearBottom,
    messages,
    messageState,
    resetNewChannelMessageCount,
    scrollChannelToBottom,
    scrollerRef,
    selectedChannelId,
    setMessages,
    setSelectedChannelId,
    visibleMessages,
  } = channelMessages;
  const {
    addThreadRootLabels,
    channelThreadsByChannelId,
    textChannelsWithThreads,
    threadRootLabels,
    upsertChannelThreadSummary,
  } = useCommunityChannelThreads({
    channelTopologyKey,
    communityId: community.id,
    messages,
    onCommunityChannelsUpdated,
    projectChannelMessages,
    selectedChannelId,
    session,
    textChannels,
  });
  const { draft, setDraft: setSelectedChannelDraft } = useCommunityDrafts({
    communityId: community.id,
    selectedChannelId,
    session,
  });
  const owner = community.ownerIdentityId === session.identity.id;
  const network =
    nodeNetworks.find((item) => item.id === community.networkId) ?? null;
  const networkName = network?.name ?? shortId(community.networkId);
  const selectedChannel = textChannelsWithThreads.find(
    (channel) => channel.id === selectedChannelId,
  );
  const canManageMessages = currentPermissions.has('manage_messages');
  const closeMessageContextMenu = useCallback(
    () => setMessageContextMenu(null),
    [],
  );
  const {
    close: closePinnedMessages,
    collection: messageCollection,
    messageIds: pinnedMessageIds,
    open: openPinnedMessages,
    pin: pinMessage,
    unpin: unpinMessage,
    unpinFromCollection: unpinMessageFromDialog,
  } = useCommunityPinnedMessages({
    canManageMessages,
    closeMessageMenu: closeMessageContextMenu,
    communityId: community.id,
    projectMessages: projectChannelMessages,
    realtimeEvent,
    selectedChannelId,
    session,
  });
  const showPinnedMessages = useCallback(() => {
    setCommunityMenuOpen(false);
    void openPinnedMessages();
  }, [openPinnedMessages]);
  const { selectedChannelPolls, upsertPoll } = useCommunityChannelPolls(
    community.id,
    selectedChannelId,
  );
  const channelNameFor = useCallback(
    (channelId: string) =>
      textChannelsWithThreads.find((channel) => channel.id === channelId)
        ?.name ?? shortId(channelId),
    [textChannelsWithThreads],
  );
  const {
    handleSearchResultClick,
    queueFocusedMessage,
    scrollToChannelMessage,
  } = useCommunityMessageFocus({
    handleChannelSelected,
    messageState,
    scrollerRef,
    selectedChannelId,
    setMessages,
  });
  const messageSearch = useCommunityMessageSearch({
    channelNameFor,
    communityId: community.id,
    communityIsPublic,
    onResultClick: handleSearchResultClick,
    projectChannelMessage,
    selectedChannelId,
    session,
  });
  const {
    open: openMessageThread,
    openFromSummary: openMessageThreadFromSummary,
  } = useCommunityThreadNavigation({
    communityId: community.id,
    currentIdentityId: session.identity.id,
    messages,
    onChannelSelected: handleChannelSelected,
    projectMessages: projectChannelMessages,
    selectedChannelId,
    session,
    setMessageContextMenu,
    setThreadPanel,
    upsertSummary: upsertChannelThreadSummary,
  });
  const activeVoiceChannelId =
    activeCall?.kind === 'community-voice' &&
    activeCall.communityId === community.id
      ? (activeCall.channelId ?? null)
      : null;
  const { visibleTextChannels, visibleVoiceChannels } =
    useCommunityVisibleChannels({
      accessibleTextChannels,
      accessibleVoiceChannels,
      activeVoiceChannelId,
      channelNotificationSetting,
      channelSearch,
      selectedChannelId,
      textChannelsWithThreads,
    });
  const historicalIdentityIds = useMemo(
    () =>
      communityMessageIdentityIds({
        messages: [
          ...messages,
          ...(threadPanel ? [threadPanel.root, ...threadPanel.messages] : []),
          ...(messageCollection?.messages ?? []),
          ...messageSearch.results.map((result) => result.message),
        ],
        polls: selectedChannelPolls,
      }),
    [
      messageCollection?.messages,
      messages,
      messageSearch.results,
      selectedChannelPolls,
      threadPanel,
    ],
  );
  const {
    communityMemberIds,
    memberIdentities,
    memberPictures,
    members,
    ownIdentityPictures,
    reactionAuthorNames,
    voiceParticipantsByChannelId,
  } = useCommunityMembers({
    activeCall,
    activeVoiceChannelId,
    community,
    extraIdentityIds: historicalIdentityIds,
    session,
    visibleVoiceChannels,
    voiceChannels,
  });
  const communityIdentityNames = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(memberIdentities).map(([identityId, identity]) => [
          identityId,
          memberDisplayName(identity, identityId),
        ]),
      ),
    [memberIdentities],
  );
  const threadLabelByRootMessageId = useCommunityThreadLabels({
    addThreadRootLabels,
    collectionMessages: messageCollection?.messages,
    messages,
    searchResults: messageSearch.results,
    threadPanel,
    threadRootLabels,
  });
  const mentions = useCommunityMentions({
    community,
    draft,
    identities: memberIdentities,
    members,
    permissions: currentPermissions,
    selectedChannel,
    setDraft: setSelectedChannelDraft,
  });
  const channelEncryptionReady = CommunityChannelEncryption.ready({
    communityMemberIds,
    currentIdentityId: session.identity.id,
    encryptionState,
    memberIdentities,
    selectedChannel,
  });
  const channelEncryptionTooltip = CommunityChannelEncryption.tooltip({
    encryptionState,
    ready: channelEncryptionReady,
  });
  const awaitingGroupAccess = CommunityChannelEncryption.awaitingGroupAccess(encryptionState);
  const profiles = useCommunityProfileViewer({
    memberIdentities,
    memberPictures,
    session,
  });
  const joinVoiceChannel = useCallback(
    (channel: Parameters<NonNullable<typeof onJoinVoiceChannel>>[0]) => {
      if (!currentPermissions.has('connect_voice')) return;

      onJoinVoiceChannel?.(channel);
    },
    [currentPermissions, onJoinVoiceChannel],
  );
  const communityLeave = useCommunityLeave({
    community,
    onBeforeLeft: () => setCommunityMenuOpen(false),
    onCommunityLeft,
    onSessionUpdated,
    session,
  });
  const communityData = useMemo(
    () => ({
      frontendDerived: {
        channelEncryptionReady,
        communityId: community.id,
        communityName: community.name,
        loadedMessages: messages.length,
        memberCount: community.memberIds.length,
        networkId: community.networkId,
        networkName,
      },
      serverChannel: selectedChannel ?? null,
      serverCommunity: community,
    }),
    [
      channelEncryptionReady,
      community,
      messages.length,
      networkName,
      selectedChannel,
    ],
  );

  useEffect(() => {
    const nextSelectedChannel =
      accessibleTextChannels.find((channel) => channel.id === activeChannelId)
        ?.id ??
      accessibleTextChannels.find((channel) => channel.id === selectedChannelId)
        ?.id ??
      accessibleTextChannels[0]?.id ??
      null;

    setSelectedChannelId(nextSelectedChannel);

    if (nextSelectedChannel) onChannelSelected(nextSelectedChannel);
  }, [
    accessibleTextChannels,
    activeChannelId,
    onChannelSelected,
    selectedChannelId,
  ]);

  useCommunityRefresh(community, onCommunityUpdated, session);

  const pollWorkflow = useCommunityPollWorkflow({
    communityId: community.id,
    scrollToBottom: scrollChannelToBottom,
    selectedChannelId: selectedChannel?.id ?? null,
    session,
    upsertPoll,
  });
  const messageComposer = useCommunityMessageComposer({
    community,
    currentPermissions,
    draft,
    memberIdentities,
    messages,
    onTypingActive,
    owner,
    projectChannelMessage,
    scrollChannelToBottom,
    scrollerRef,
    selectedChannel,
    selectedChannelId,
    selectedChannelPolls,
    session,
    setDraft: setSelectedChannelDraft,
    setMessages,
  });
  const threadActions = useCommunityThreadActions({
    channelThreadsByChannelId,
    messageComposer,
    selectedChannelId,
    setMessageContextMenu,
    setMessages,
    setThreadPanel,
    threadPanel,
    upsertChannelThreadSummary,
  });
  const handleTextChannelSelected = useCallback(
    (channelId: string) => {
      const leavingThreadInCurrentChannel =
        !!threadPanel && channelId === selectedChannelId;

      setThreadPanel(null);
      handleChannelSelected(channelId);

      if (leavingThreadInCurrentChannel) {
        requestAnimationFrame(() => scrollChannelToBottom('auto', true));
      }
    },
    [
      handleChannelSelected,
      scrollChannelToBottom,
      selectedChannelId,
      threadPanel,
    ],
  );
  useEffect(() => {
    messageComposer.resetForChannelChange();
  }, [selectedChannelId]);

  useEffect(() => {
    if (!threadPanel || threadPanel.channelId === selectedChannelId) return;

    setThreadPanel(null);
  }, [selectedChannelId, threadPanel]);

  const shouldCountNewChannelMessage = useCallback(
    (channelId: string) =>
      !NotificationSettingsPolicy.isMuted(
        channelNotificationSetting({ id: channelId }),
      ),
    [channelNotificationSetting],
  );

  useCommunityChannelRealtime({
    communityId: community.id,
    incrementNewChannelMessageCount,
    isScrolledNearBottom,
    loadChannelMessages,
    onChannelViewed,
    onMessageDeleted: threadActions.applyRealtimeDeletion,
    onMessageEdited: threadActions.applyRealtimeEdit,
    onThreadMessageReceived: threadActions.receiveRealtimeMessage,
    projectChannelMessage,
    realtimeEvent,
    resetNewChannelMessageCount,
    scrollChannelToBottom,
    selectedChannelId,
    session,
    setMessages,
    shouldCountNewChannelMessage,
    upsertPoll,
  });

  return (
    <>
      <CommunitySidebar
        onSessionUpdated={onSessionUpdated}
        activeCall={activeCall}
        activeVoiceChannelId={activeVoiceChannelId}
        animateEntries={animateSidePanelEntries}
        animationScopeKey={community.id}
        bannerUrl={bannerUrl}
        canManageCommunity={
          owner ||
          currentPermissions.has('manage_channels') ||
          currentPermissions.has('manage_roles') ||
          currentPermissions.has('ban_members')
        }
        channelSearch={channelSearch}
        channelUnreadCounts={channelUnreadCounts}
        community={community}
        communityIsPublic={communityIsPublic}
        mobileRail={mobileRail}
        mobileSidebarOpen={mobileSidebarOpen}
        nodeNetworks={nodeNetworks}
        onBannerOpen={communityVisualAssets.openBannerViewer}
        onCallEnd={onCallEnd}
        onCallParticipantScreenShareVolumeChange={
          onCallParticipantScreenShareVolumeChange
        }
        onCallParticipantVolumeChange={onCallParticipantVolumeChange}
        onCallScreenShareQualityChange={onCallScreenShareQualityChange}
        onCallToggleCamera={onCallToggleCamera}
        onCallToggleDeafen={onCallToggleDeafen}
        onCallToggleMicrophone={onCallToggleMute}
        onCallToggleMediaEncryption={onCallToggleMediaEncryption}
        onCallToggleNoiseCancellation={onCallToggleNoiseCancellation}
        onCallRetryMicrophone={onCallRetryMicrophone}
        onCallRetryConnection={onCallRetryConnection}
        onCallToggleScreenShare={onCallToggleScreenShare}
        onChannelSearchChange={setChannelSearch}
        onManageOpen={() => setManageOpen(true)}
        onMobileSidebarClose={onMobileSidebarClose}
        onPresenceChange={onPresenceChange}
        onPresenceStatusSelected={onPresenceStatusSelected}
        onTextChannelSelected={handleTextChannelSelected}
        onTextChannelMuteToggle={(channel) =>
          onNotificationMuteToggle(channelNotificationScope(channel.id))
        }
        onTextChannelNotificationSettingsOpen={(channel) =>
          onNotificationSettingsOpen({
            scope: channelNotificationScope(channel.id),
            subtitle: community.name,
            title: `# ${channel.name}`,
          })
        }
        onThreadSelected={(channel, thread) =>
          void openMessageThreadFromSummary(channel.id, thread)
        }
        onVoiceChannelJoin={joinVoiceChannel}
        onVoiceParticipantClick={profiles.openVoiceParticipantProfile}
        onLogout={onLogout}
        ownIdentityPictures={ownIdentityPictures}
        presence={presenceByIdentityId[session.identity.id]}
        selectedChannelId={selectedChannelId}
        selectedThreadRootMessageId={threadPanel?.root.id}
        session={session}
        textChannels={textChannelsWithThreads}
        textChannelNotificationSetting={channelNotificationSetting}
        threadLabelByRootMessageId={threadLabelByRootMessageId}
        visibleTextChannels={visibleTextChannels}
        visibleVoiceChannels={visibleVoiceChannels}
        voiceChannelNotificationSetting={channelNotificationSetting}
        voiceChannels={voiceChannels}
        voiceParticipantsByChannelId={voiceParticipantsByChannelId}
      />

      <section className="app-safe-area-panel glass-panel-strong flex min-h-0 flex-col overflow-hidden rounded-none">
        <CommunityWorkspaceHeader
          avatarUrl={avatarUrl}
          canAddMember={
            !!selectedChannel &&
            (owner || currentPermissions.has('create_invites'))
          }
          channelEncryptionReady={channelEncryptionReady}
          channelEncryptionTooltip={channelEncryptionTooltip}
          community={community}
          communityIsPublic={communityIsPublic}
          communityLeaveError={communityLeave.error}
          communityLeaving={communityLeave.leaving}
          communityMenuOpen={communityMenuOpen}
          communityNotificationSetting={communityNotificationSetting}
          messageSearchOpen={messageSearch.open}
          networkName={networkName}
          onAddMember={() => setMemberOpen(true)}
          onCommunityDataOpen={() => {
            setCommunityDataOpen(true);
            setCommunityMenuOpen(false);
          }}
          onCommunityMenuClose={() => setCommunityMenuOpen(false)}
          onCommunityMenuToggle={() =>
            setCommunityMenuOpen((isOpen) => !isOpen)
          }
          onEncryptionDetailsOpen={() => setEncryptionDetailsOpen(true)}
          onLeaveCommunity={() => void communityLeave.leave()}
          onMessageSearchToggle={() =>
            messageSearch.setOpen(!messageSearch.open)
          }
          onNotificationMuteToggle={() =>
            onNotificationMuteToggle(communityNotificationScope)
          }
          onNotificationSettingsOpen={() =>
            onNotificationSettingsOpen({
              scope: communityNotificationScope,
              subtitle: networkName,
              title: community.name,
            })
          }
          onOpenAvatar={communityVisualAssets.openAvatarViewer}
          onOpenMobileSidebar={onOpenMobileSidebar}
          onPinsOpen={showPinnedMessages}
          onRealtimeEventsOpen={onRealtimeEventsOpen}
          realtimeStatus={realtimeStatus}
          selectedChannel={selectedChannel}
        />

        {communityIsPublic && messageSearch.open ? (
          <CommunityMessageSearchPanel
            disabled={!selectedChannel && messageSearch.scope === 'channel'}
            error={messageSearch.error}
            onClose={() => messageSearch.setOpen(false)}
            onQueryChange={messageSearch.setQuery}
            onResultClick={messageSearch.onResultClick}
            onScopeChange={messageSearch.setScope}
            onSubmit={() => void messageSearch.submit()}
            query={messageSearch.query}
            results={messageSearch.results}
            searched={messageSearch.searched}
            scope={messageSearch.scope}
            state={messageSearch.state}
          />
        ) : null}

        {threadPanel ? (
          <CommunityThreadPane
            channelName={channelNameFor(threadPanel.channelId)}
            communityIsPublic={communityIsPublic}
            currentPermissions={currentPermissions}
            encryptionAvailable={encryptionState === 'ready'}
            identityNames={communityIdentityNames}
            memberIdentities={memberIdentities}
            memberPictures={memberPictures}
            messagesLoading={messageState === 'loading'}
            onAuthorProfileOpen={profiles.openMessageAuthorProfile}
            onClose={() => setThreadPanel(null)}
            onMessageMenuOpen={(message, x, y) =>
              setMessageContextMenu({ message, source: 'thread', x, y })
            }
            onRootMessageOpen={(message) => {
              queueFocusedMessage(threadPanel.channelId, message);
              setMessages((current) => mergeChatMessages(current, [message]));
              handleChannelSelected(threadPanel.channelId);
              setThreadPanel(null);

              if (
                threadPanel.channelId === selectedChannelId &&
                messageState !== 'loading'
              ) {
                window.setTimeout(() => scrollToChannelMessage(message.id), 0);
              }
            }}
            pinnedMessageIds={pinnedMessageIds}
            session={session}
            threadActions={threadActions}
            threadPanel={threadPanel}
          />
        ) : !selectedChannel ? (
          <CommunityNoChannelSelected />
        ) : (
          <CommunityConversation
            channelMessages={channelMessages}
            communityIsPublic={communityIsPublic}
            currentPermissions={currentPermissions}
            currentRoleIds={currentRoleIds}
            draft={draft}
            encryptionAvailable={encryptionState === 'ready'}
            invitationAccepting={invitationAccepting}
            invitationError={invitationError}
            invitationInviterName={invitationInviterName}
            memberIdentities={memberIdentities}
            memberPictures={memberPictures}
            mentions={mentions}
            messageComposer={messageComposer}
            awaitingGroupAccess={awaitingGroupAccess}
            onInvitationAccept={onInvitationAccept}
            onMessageMenuOpen={(message, x, y) =>
              setMessageContextMenu({ message, x, y })
            }
            onOpenThread={(message) => void openMessageThread(message)}
            onPollDialogClose={() => setPollDialogOpen(false)}
            onPollDialogOpen={() => setPollDialogOpen(true)}
            onStickerClick={setStickerPackPreview}
            onStickerPreviewClose={() => setStickerPackPreview(null)}
            pendingInvitation={pendingInvitation}
            pinnedMessageIds={pinnedMessageIds}
            pollDialogOpen={pollDialogOpen}
            pollWorkflow={pollWorkflow}
            polls={selectedChannelPolls}
            profiles={profiles}
            reactionAuthorNames={reactionAuthorNames}
            selectedChannel={selectedChannel}
            session={session}
            stickerPackPreview={stickerPackPreview}
            typingIdentityIds={typingIdentityIds}
          />
        )}
      </section>

      <CommunityMembersPanel
        community={community}
        animateEntries={animateSidePanelEntries}
        animationScopeKey={community.id}
        canInvite={
          Boolean(selectedChannel) &&
          (owner || currentPermissions.has('create_invites'))
        }
        members={selectedChannel ? members : []}
        onAddMember={() => setMemberOpen(true)}
        onCloseMobile={onMobileMembersClose}
        onMemberClick={(member, event) =>
          profiles.openMemberProfile(
            member,
            profileAnchorFromTarget(event.currentTarget),
          )
        }
        openMobile={mobileMembersOpen}
        presenceByIdentityId={presenceByIdentityId}
      />

      {messageCollection ? (
        <CommunityPinnedMessagesDialog
          canManageMessages={canManageMessages}
          collection={messageCollection}
          identityNames={communityIdentityNames}
          identityPictures={memberPictures}
          onClose={closePinnedMessages}
          onMessageOpen={(message) => {
            closePinnedMessages();
            setMessages((current) => mergeChatMessages(current, [message]));
            scrollToChannelMessage(message.id);
          }}
          onUnpin={unpinMessageFromDialog}
        />
      ) : null}

      <CommunityWorkspaceDialogs
        {...communityMessageMenuActions({
          messageComposer,
          messageContextMenu,
          openMessageThread,
          pinMessage,
          setMessageContextMenu,
          setRawMessage,
          threadActions,
          unpinMessage,
        })}
        avatarUrl={avatarUrl}
        avatarViewerOpen={avatarViewerOpen}
        bannerUrl={bannerUrl}
        bannerViewerOpen={bannerViewerOpen}
        community={community}
        communityData={communityData}
        communityDataOpen={communityDataOpen}
        currentIdentityId={session.identity.id}
        currentPermissions={currentPermissions}
        encryptionDetails={
          encryptionDetailsOpen
            ? CommunityEncryptionDetails.create({
                channelEncryptionReady,
                community,
                communityIsPublic,
                networkName,
                selectedChannel,
              })
            : null
        }
        manageOpen={manageOpen}
        memberOpen={memberOpen}
        messageContextMenu={messageContextMenu}
        nodeNetworks={nodeNetworks}
        onCloseAvatarViewer={communityVisualAssets.closeAvatarViewer}
        onCloseBannerViewer={communityVisualAssets.closeBannerViewer}
        onCloseCommunityData={() => setCommunityDataOpen(false)}
        onCloseEncryptionDetails={() => setEncryptionDetailsOpen(false)}
        onCloseManage={() => setManageOpen(false)}
        onCloseMember={() => setMemberOpen(false)}
        onCloseMessageContextMenu={() => setMessageContextMenu(null)}
        onCloseProfile={profiles.close}
        onCloseRawMessage={() => setRawMessage(null)}
        onCommunityUpdated={onCommunityUpdated}
        onOpenConversationWithIdentity={onOpenConversationWithIdentity}
        owner={owner}
        presenceByIdentityId={presenceByIdentityId}
        pinnedMessageIds={pinnedMessageIds}
        profileViewer={profiles.profileViewer}
        rawMessage={rawMessage}
        session={session}
      />
    </>
  );
}
