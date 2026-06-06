import { lazy, Suspense, useEffect, useState, type ReactElement } from 'react';

import type { NodeNetwork } from '../../../../contexts/networks/application/list-node-networks/ListNodeNetworks';
import type { Peer } from '../../../../contexts/networks/application/list-peers/ListPeers';
import type {
  CallParticipant,
  CallResource,
} from '../../../../contexts/calls/domain/callSession.types';
import type {
  ChatMessage,
  Community,
  CommunityMembershipRequest,
  ConversationResource,
  IdentityPresence,
  IdentityResource,
  MessageAttachment,
  NotificationScopeSetting,
  NotificationScopeSettingInput,
  NotificationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/realtimeGateway';

import { MessageEditPolicy } from '../../../../contexts/messages/domain/MessageEditPolicy';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { SegmentedControl } from '../../../../shared/presentation/components/segmentedControl';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import { Inspector } from './Inspector';
import {
  MessageContextMenu,
  type MessageContextMenuState,
} from './messageContextMenu';
import type { NotificationScopeSettingsTarget } from '../../../../contexts/notifications/presentation/components/NotificationScopeSettingsDialog';

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

interface WorkspaceDialogsProps {
  activeConversation?: ConversationResource;
  activeConversationPeerIdentityId?: string;
  archiveNotification: (notificationId: string) => void;
  communities: Community[];
  communityAvatarUrls: Record<string, string>;
  communityPreviews: Record<string, Community>;
  conversations: ConversationResource[];
  identityNames: Record<string, string>;
  identityPictures: Record<string, string>;
  identityProfiles: Record<string, IdentityResource>;
  incomingCall: {
    call: CallResource;
    caller?: CallParticipant;
    participants: CallParticipant[];
    title: string;
  } | null;
  inspectorOpen: boolean;
  isCreateCommunityOpen: boolean;
  isCreateOpen: boolean;
  membershipRequestAction: 'accept' | 'decline' | 'refresh' | null;
  membershipRequestError: string | null;
  membershipRequests: CommunityMembershipRequest[];
  messageContextMenu: MessageContextMenuState | null;
  messages: ChatMessage[];
  node: { id: string; owner: null | string } | null;
  nodeNetworks: NodeNetwork[];
  nodeSettingsOpen: boolean;
  notificationAction: 'accept' | 'archive' | 'decline' | 'refresh' | null;
  notificationError: string | null;
  notificationSettingsError: null | string;
  notificationSettingsSetting: NotificationScopeSetting | null;
  notificationSettingsTarget: NotificationScopeSettingsTarget | null;
  notificationsOpen: boolean;
  peers: Peer[];
  presenceByIdentityId: Record<string, IdentityPresence>;
  rawMessage: ChatMessage | null;
  realtimeEventLog: RealtimeDomainEvent[];
  realtimeEventsOpen: boolean;
  session: Session;
  visibleNotifications: NotificationResource[];
  onAcceptIncomingCall: () => void;
  onAcceptNotification: (notification: NotificationResource) => void;
  onCloseCreateCommunity: () => void;
  onCloseCreateConversation: () => void;
  onCloseInspector: () => void;
  onCloseMessageContextMenu: () => void;
  onCloseNodeSettings: () => void;
  onCloseNotifications: () => void;
  onCloseNotificationSettings: () => void;
  onCloseRawMessage: () => void;
  onCloseRealtimeEvents: () => void;
  onCommunityCreated: (input: {
    community: Community;
    session: Session;
  }) => void;
  onCommunityJoinRequested: (request: CommunityMembershipRequest) => void;
  onConversationCreated: (
    nextSession: Session,
    conversation: ConversationResource,
  ) => void;
  onGroupInviteOpen: () => void;
  onOpenConversationWithIdentity?: (
    identityId: string,
    identity?: IdentityResource,
    networkId?: string,
  ) => Promise<void>;
  onDeclineIncomingCall: () => void;
  onDeclineMembershipRequest: (requestId: string) => void;
  onAcceptMembershipRequest: (requestId: string) => void;
  onDeclineNotification: (notificationId: string) => void;
  onNotificationSettingReset: (
    scope: NotificationScopeSettingsTarget['scope'],
  ) => void;
  onNotificationSettingSave: (setting: NotificationScopeSettingInput) => void;
  onDeleteMessage: (message: ChatMessage) => void;
  onDownloadAttachment: (attachment: MessageAttachment) => void;
  onEditMessage: (message: ChatMessage) => void;
  onNetworksUpdated: () => Promise<void>;
  onCopyMessage: (message: ChatMessage) => void;
  onOpenMessageThread: (message: ChatMessage) => void;
  onPinMessage: (message: ChatMessage) => void;
  onReplyToMessage: (message: ChatMessage) => void;
  onUnpinMessage: (message: ChatMessage) => void;
  pinnedMessageIds: ReadonlySet<string>;
  onToggleReaction: (
    message: ChatMessage,
    emoji: string,
    reacted: boolean,
  ) => void;
  onViewRawMessage: (message: ChatMessage) => void;
}

export function WorkspaceDialogs(props: WorkspaceDialogsProps): ReactElement {
  const [communityEntryMode, setCommunityEntryMode] =
    useState<CommunityEntryMode>('discover');

  useEffect(() => {
    if (props.isCreateCommunityOpen) setCommunityEntryMode('discover');
  }, [props.isCreateCommunityOpen]);

  return (
    <>
      <MobileInspectorDialog {...props} />
      <MessageActionDialogs {...props} />
      <CreateDialogs
        {...props}
        communityEntryMode={communityEntryMode}
        onCommunityEntryModeChange={setCommunityEntryMode}
      />
      <WorkspaceNotificationDialog {...props} />
      <NotificationSettingsOverlay {...props} />
      <NodeSettingsOverlay {...props} />
      <RealtimeEventsOverlay {...props} />
      <IncomingCallOverlay {...props} />
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
  props: WorkspaceDialogsProps,
): ReactElement | null {
  const { close, state } = useCloseTransition(props.onCloseInspector);

  useCloseOnEscape(close, props.inspectorOpen);

  if (!props.inspectorOpen) return null;

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
        activeConversationPeerIdentityId={props.activeConversationPeerIdentityId}
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
  props: WorkspaceDialogsProps,
): ReactElement | null {
  const contextMenuMessage = props.messageContextMenu?.message;
  const contextMenuFromThread = props.messageContextMenu?.source === 'thread';
  const contextMenuMessagePinned = contextMenuMessage
    ? isPinnedMessage(contextMenuMessage, props.pinnedMessageIds)
    : false;

  if (!props.messageContextMenu) {
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
        menu={props.messageContextMenu}
        onClose={props.onCloseMessageContextMenu}
        onCopy={
          contextMenuMessage?.content
            ? () => props.onCopyMessage(contextMenuMessage)
            : undefined
        }
        onDelete={
          contextMenuMessage?.kind !== 'poll' &&
          contextMenuMessage?.authorIdentityId === props.session.identity.id
            ? () => props.onDeleteMessage(contextMenuMessage)
            : undefined
        }
        onDownloadAttachment={props.onDownloadAttachment}
        onEdit={
          contextMenuMessage &&
          !contextMenuFromThread &&
          MessageEditPolicy.canEdit(
            contextMenuMessage,
            props.session.identity.id,
          )
            ? () => props.onEditMessage(contextMenuMessage)
            : undefined
        }
        onOpenThread={
          contextMenuMessage &&
          contextMenuMessage.kind !== 'poll' &&
          !contextMenuFromThread
            ? () => props.onOpenMessageThread(contextMenuMessage)
            : undefined
        }
        onPin={
          contextMenuMessage &&
          contextMenuMessage.kind !== 'poll' &&
          !contextMenuFromThread &&
          !contextMenuMessagePinned
            ? () => props.onPinMessage(contextMenuMessage)
            : undefined
        }
        onReply={
          contextMenuMessage && contextMenuMessage.kind !== 'poll'
            ? () => props.onReplyToMessage(contextMenuMessage)
            : undefined
        }
        onUnpin={
          contextMenuMessage &&
          contextMenuMessage.kind !== 'poll' &&
          !contextMenuFromThread &&
          contextMenuMessagePinned
            ? () => props.onUnpinMessage(contextMenuMessage)
            : undefined
        }
        pinned={contextMenuMessagePinned}
        onReactionToggle={props.onToggleReaction}
        onViewRaw={() => {
          if (contextMenuMessage) props.onViewRawMessage(contextMenuMessage);
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
  return pinnedMessageIds.has(message.id) || Boolean(message.raw.pinnedByIdentityId);
}

function CreateDialogs(
  props: WorkspaceDialogsProps & {
    communityEntryMode: CommunityEntryMode;
    onCommunityEntryModeChange: (mode: CommunityEntryMode) => void;
  },
): ReactElement | null {
  if (props.isCreateOpen) {
    return (
      <Suspense fallback={null}>
        <CreateConversationDialog
          conversations={props.conversations}
          nodeNetworks={props.nodeNetworks}
          session={props.session}
          onClose={props.onCloseCreateConversation}
          onCreated={props.onConversationCreated}
        />
      </Suspense>
    );
  }

  if (!props.isCreateCommunityOpen) return null;

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
          onClose={props.onCloseCreateCommunity}
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
        onClose={props.onCloseCreateCommunity}
        onJoinRequested={props.onCommunityJoinRequested}
        session={props.session}
      />
    </Suspense>
  );
}

function WorkspaceNotificationDialog(
  props: WorkspaceDialogsProps,
): ReactElement | null {
  if (!props.notificationsOpen) return null;

  return (
    <Suspense fallback={null}>
      <NotificationsPanel
        action={props.notificationAction}
        communities={props.communities}
        communityAvatarUrls={props.communityAvatarUrls}
        communityPreviews={props.communityPreviews}
        conversations={props.conversations}
        currentIdentityId={props.session.identity.id}
        error={props.notificationError}
        identityNames={props.identityNames}
        identityPictures={props.identityPictures}
        identityProfiles={props.identityProfiles}
        membershipAction={props.membershipRequestAction}
        membershipError={props.membershipRequestError}
        membershipRequests={props.membershipRequests}
        notifications={props.visibleNotifications}
        onAcceptMembershipRequest={props.onAcceptMembershipRequest}
        onAccept={props.onAcceptNotification}
        onArchive={props.archiveNotification}
        onClose={props.onCloseNotifications}
        onDeclineMembershipRequest={props.onDeclineMembershipRequest}
        onDecline={props.onDeclineNotification}
      />
    </Suspense>
  );
}

function NotificationSettingsOverlay(
  props: WorkspaceDialogsProps,
): ReactElement | null {
  if (!props.notificationSettingsTarget || !props.notificationSettingsSetting) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <NotificationScopeSettingsDialog
        error={props.notificationSettingsError}
        onClose={props.onCloseNotificationSettings}
        onReset={props.onNotificationSettingReset}
        onSave={props.onNotificationSettingSave}
        setting={props.notificationSettingsSetting}
        target={props.notificationSettingsTarget}
      />
    </Suspense>
  );
}

function NodeSettingsOverlay(
  props: WorkspaceDialogsProps,
): ReactElement | null {
  if (!props.nodeSettingsOpen) return null;

  return (
    <Suspense fallback={null}>
      <NodeSettingsDialog
        networks={props.nodeNetworks}
        node={props.node}
        onClose={props.onCloseNodeSettings}
        onNetworksUpdated={props.onNetworksUpdated}
        peers={props.peers}
        session={props.session}
      />
    </Suspense>
  );
}

function RealtimeEventsOverlay(
  props: WorkspaceDialogsProps,
): ReactElement | null {
  if (!props.realtimeEventsOpen) return null;

  return (
    <Suspense fallback={null}>
      <RealtimeEventsDialog
        events={props.realtimeEventLog}
        onClose={props.onCloseRealtimeEvents}
      />
    </Suspense>
  );
}

function IncomingCallOverlay(
  props: WorkspaceDialogsProps,
): ReactElement | null {
  if (!props.incomingCall) return null;

  return (
    <Suspense fallback={null}>
      <IncomingCallDialog
        caller={props.incomingCall.caller}
        onAccept={props.onAcceptIncomingCall}
        onDecline={props.onDeclineIncomingCall}
        title={props.incomingCall.title}
      />
    </Suspense>
  );
}
