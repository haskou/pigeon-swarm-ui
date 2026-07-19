import { lazy, Suspense, useEffect, useState, type ReactElement } from 'react';

import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';
import type {
  WorkspaceCreationDialogs,
  WorkspaceDialogSections,
  WorkspaceIncomingCallDialog,
  WorkspaceInspectorDialog,
  WorkspaceMessageActionDialogs,
  WorkspaceNodeSettingsDialog,
  WorkspaceNotificationSettingsDialog,
  WorkspaceNotificationsDialog,
  WorkspaceRealtimeEventsDialog,
} from './WorkspaceDialogSections';

import { MessageEditability } from '../../../../contexts/messages/presentation/view-models/MessageEditability';
import { conversationSupportsThreads } from '../../../../contexts/conversations/presentation/view-models/conversationSupportsThreads';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { SegmentedControl } from '../../../../shared/presentation/components/segmentedControl';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import { Inspector } from './Inspector';
import { MessageContextMenu } from './messageContextMenu';

const CommunityDiscoveryDialog = lazy(() =>
  import('../../../../contexts/communities/presentation/components/CommunityDiscoveryDialog').then(
    (module) => ({
      default: module.CommunityDiscoveryDialog,
    }),
  ),
);
const CreateCommunityDialog = lazy(() =>
  import('../../../../contexts/communities/presentation/components/CreateCommunityDialog').then(
    (module) => ({
      default: module.CreateCommunityDialog,
    }),
  ),
);
const CreateConversationDialog = lazy(() =>
  import('../../../../contexts/conversations/presentation/components/CreateConversationDialog').then(
    (module) => ({
      default: module.CreateConversationDialog,
    }),
  ),
);
const IncomingCallDialog = lazy(() =>
  import('../../../../contexts/calls/presentation/components/IncomingCallDialog').then(
    (module) => ({
      default: module.IncomingCallDialog,
    }),
  ),
);
const NodeSettingsDialog = lazy(() =>
  import('./NodeSettingsDialog').then((module) => ({
    default: module.NodeSettingsDialog,
  })),
);
const NotificationsPanel = lazy(() =>
  import('../../../../contexts/notifications/presentation/components/NotificationsPanel').then(
    (module) => ({
      default: module.NotificationsPanel,
    }),
  ),
);
const NotificationScopeSettingsDialog = lazy(() =>
  import('../../../../contexts/notifications/presentation/components/NotificationScopeSettingsDialog').then(
    (module) => ({
      default: module.NotificationScopeSettingsDialog,
    }),
  ),
);
const RawMessageDialog = lazy(() =>
  import('./RawMessageDialog').then((module) => ({
    default: module.RawMessageDialog,
  })),
);
const RealtimeEventsDialog = lazy(() =>
  import('./RealtimeEventsDialog').then((module) => ({
    default: module.RealtimeEventsDialog,
  })),
);

export function WorkspaceDialogs({
  creation,
  incomingCall,
  inspector,
  messageActions,
  nodeSettings,
  notificationSettings,
  notifications,
  realtimeEvents,
}: WorkspaceDialogSections): ReactElement {
  const [communityEntryMode, setCommunityEntryMode] =
    useState<CommunityEntryMode>('discover');

  useEffect(() => {
    if (creation.createCommunityOpen) setCommunityEntryMode('discover');
  }, [creation.createCommunityOpen]);

  return (
    <>
      <MobileInspectorDialog {...inspector} />
      <MessageActionDialogs {...messageActions} />
      <CreateDialogs
        {...creation}
        communityEntryMode={communityEntryMode}
        onCommunityEntryModeChange={setCommunityEntryMode}
      />
      <WorkspaceNotificationDialog {...notifications} />
      <NotificationSettingsOverlay {...notificationSettings} />
      <NodeSettingsOverlay {...nodeSettings} />
      <RealtimeEventsOverlay {...realtimeEvents} />
      <IncomingCallOverlay {...incomingCall} />
    </>
  );
}

type CommunityEntryMode = 'create' | 'discover';

function CommunityEntryModeControl({
  mode,
  onChange,
}: {
  mode: CommunityEntryMode;
  onChange: (mode: CommunityEntryMode) => void;
}): ReactElement {
  return (
    <SegmentedControl
      className="mt-5"
      onChange={onChange}
      value={mode}
      options={[
        { label: copy.communities.discoverTab, value: 'discover' },
        { label: copy.communities.createTab, value: 'create' },
      ]}
    />
  );
}

function MobileInspectorDialog(
  props: WorkspaceInspectorDialog,
): ReactElement | null {
  const { close, state } = useCloseTransition(props.onClose);

  useCloseOnEscape(close, props.open);

  if (!props.open) return null;

  return (
    <>
      <button
        className="app-overlay-scrim fixed inset-0 z-40 bg-black/50 xl:hidden"
        data-state={state}
        onClick={close}
        aria-label={copy.dialog.close}
      />
      <Inspector
        session={props.session}
        activeConversation={props.activeConversation}
        activeConversationPeerIdentityId={
          props.activeConversationPeerIdentityId
        }
        identityNames={props.identityNames}
        identityPictures={props.identityPictures}
        identityProfiles={props.identityProfiles}
        nodeNetworks={props.nodeNetworks}
        onGroupInviteOpen={props.onGroupInviteOpen}
        onOpenConversationWithIdentity={props.onOpenConversationWithIdentity}
        presenceByIdentityId={props.presenceByIdentityId}
        transitionState={state}
        variant="mobile"
      />
    </>
  );
}

function MessageActionDialogs(
  props: WorkspaceMessageActionDialogs,
): ReactElement | null {
  const contextMenuMessage = props.menu?.message;
  const contextMenuFromThread = props.menu?.source === 'thread';
  const contextMenuMessagePinned = contextMenuMessage
    ? isPinnedMessage(contextMenuMessage, props.pinnedMessageIds)
    : false;

  if (!props.menu) {
    return props.rawMessage ? (
      <Suspense fallback={null}>
        <RawMessageDialog
          message={props.rawMessage}
          onClose={props.onCloseRawMessage}
        />
      </Suspense>
    ) : null;
  }

  return (
    <>
      <MessageContextMenu
        currentIdentityId={props.session.identity.id}
        menu={props.menu}
        onClose={props.onCloseMenu}
        onCopy={
          contextMenuMessage?.content
            ? () => props.onCopy(contextMenuMessage)
            : undefined
        }
        onDelete={
          contextMenuMessage?.kind !== 'poll' &&
          contextMenuMessage?.authorIdentityId === props.session.identity.id
            ? () => props.onDelete(contextMenuMessage)
            : undefined
        }
        onDownloadAttachment={props.onDownloadAttachment}
        onEdit={
          contextMenuMessage &&
          !contextMenuFromThread &&
          MessageEditability.canEdit(
            contextMenuMessage,
            props.session.identity.id,
          )
            ? () => props.onEdit(contextMenuMessage)
            : undefined
        }
        onOpenThread={
          contextMenuMessage &&
          contextMenuMessage.kind !== 'poll' &&
          !contextMenuFromThread &&
          conversationSupportsThreads(props.activeConversation)
            ? () => props.onOpenThread(contextMenuMessage)
            : undefined
        }
        onPin={
          contextMenuMessage &&
          contextMenuMessage.kind !== 'poll' &&
          !contextMenuFromThread &&
          !contextMenuMessagePinned
            ? () => props.onPin(contextMenuMessage)
            : undefined
        }
        onReply={
          contextMenuMessage && contextMenuMessage.kind !== 'poll'
            ? () => props.onReply(contextMenuMessage)
            : undefined
        }
        onUnpin={
          contextMenuMessage &&
          contextMenuMessage.kind !== 'poll' &&
          !contextMenuFromThread &&
          contextMenuMessagePinned
            ? () => props.onUnpin(contextMenuMessage)
            : undefined
        }
        pinned={contextMenuMessagePinned}
        onReactionToggle={props.onToggleReaction}
        onViewRaw={() => {
          if (contextMenuMessage) props.onViewRaw(contextMenuMessage);
        }}
      />
      {props.rawMessage && (
        <Suspense fallback={null}>
          <RawMessageDialog
            message={props.rawMessage}
            onClose={props.onCloseRawMessage}
          />
        </Suspense>
      )}
    </>
  );
}

function isPinnedMessage(
  message: ChatMessage,
  pinnedMessageIds: ReadonlySet<string>,
): boolean {
  return (
    pinnedMessageIds.has(message.id) || Boolean(message.raw.pinnedByIdentityId)
  );
}

function CreateDialogs(
  props: WorkspaceCreationDialogs & {
    communityEntryMode: CommunityEntryMode;
    onCommunityEntryModeChange: (mode: CommunityEntryMode) => void;
  },
): ReactElement | null {
  if (props.createConversationOpen) {
    return (
      <Suspense fallback={null}>
        <CreateConversationDialog
          conversations={props.conversations}
          nodeNetworks={props.nodeNetworks}
          session={props.session}
          onClose={props.onCloseConversation}
          onCreated={props.onConversationCreated}
        />
      </Suspense>
    );
  }

  if (!props.createCommunityOpen) return null;

  const modeControl = (
    <CommunityEntryModeControl
      mode={props.communityEntryMode}
      onChange={props.onCommunityEntryModeChange}
    />
  );

  if (props.communityEntryMode === 'create') {
    return (
      <Suspense fallback={null}>
        <CreateCommunityDialog
          headerControl={modeControl}
          nodeNetworks={props.nodeNetworks}
          session={props.session}
          onClose={props.onCloseCommunity}
          onCreated={props.onCommunityCreated}
        />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={null}>
      <CommunityDiscoveryDialog
        headerControl={modeControl}
        nodeNetworks={props.nodeNetworks}
        onClose={props.onCloseCommunity}
        onJoinRequested={props.onCommunityJoinRequested}
        session={props.session}
      />
    </Suspense>
  );
}

function WorkspaceNotificationDialog(
  props: WorkspaceNotificationsDialog,
): ReactElement | null {
  if (!props.open) return null;

  return (
    <Suspense fallback={null}>
      <NotificationsPanel
        action={props.action}
        communities={props.communities}
        communityAvatarUrls={props.communityAvatarUrls}
        communityPreviews={props.communityPreviews}
        conversations={props.conversations}
        currentIdentityId={props.session.identity.id}
        error={props.error}
        identityNames={props.identityNames}
        identityPictures={props.identityPictures}
        identityProfiles={props.identityProfiles}
        membershipAction={props.membershipAction}
        membershipError={props.membershipError}
        membershipRequests={props.membershipRequests}
        notifications={props.notifications}
        nodeNetworks={props.nodeNetworks}
        onAcceptMembershipRequest={props.onAcceptMembershipRequest}
        onAccept={props.onAccept}
        onArchive={props.archive}
        onClose={props.onClose}
        onDeclineMembershipRequest={props.onDeclineMembershipRequest}
        onDecline={props.onDecline}
      />
    </Suspense>
  );
}

function NotificationSettingsOverlay(
  props: WorkspaceNotificationSettingsDialog,
): ReactElement | null {
  if (!props.target || !props.setting) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <NotificationScopeSettingsDialog
        error={props.error}
        onClose={props.onClose}
        onReset={props.onReset}
        onSave={props.onSave}
        setting={props.setting}
        target={props.target}
      />
    </Suspense>
  );
}

function NodeSettingsOverlay(
  props: WorkspaceNodeSettingsDialog,
): ReactElement | null {
  if (!props.open) return null;

  return (
    <Suspense fallback={null}>
      <NodeSettingsDialog
        networkSynchronizationStatus={props.networkSynchronizationStatus}
        networks={props.networks}
        node={props.node}
        onClose={props.onClose}
        onNetworksUpdated={props.onNetworksUpdated}
        peersLoading={props.peersLoading}
        peers={props.peers}
        session={props.session}
      />
    </Suspense>
  );
}

function RealtimeEventsOverlay(
  props: WorkspaceRealtimeEventsDialog,
): ReactElement | null {
  if (!props.open) return null;

  return (
    <Suspense fallback={null}>
      <RealtimeEventsDialog events={props.events} onClose={props.onClose} />
    </Suspense>
  );
}

function IncomingCallOverlay(
  props: WorkspaceIncomingCallDialog,
): ReactElement | null {
  if (!props.incomingCall) return null;

  return (
    <Suspense fallback={null}>
      <IncomingCallDialog
        caller={props.incomingCall.caller}
        onAccept={props.onAccept}
        onDecline={props.onDecline}
        title={props.incomingCall.title}
      />
    </Suspense>
  );
}
