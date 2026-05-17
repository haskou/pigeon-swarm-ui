import { useEffect, useState, type ReactElement } from 'react';

import type { NodeNetwork } from '../../application/networks/ListNodeNetworks';
import type { Peer } from '../../application/peers/ListPeers';
import type {
  CallParticipant,
  CallResource,
} from '../../domain/calls/CallSession';
import type {
  ChatMessage,
  Community,
  CommunityMembershipRequest,
  ConversationResource,
  IdentityResource,
  NotificationResource,
  Session,
} from '../../domain/types';
import type { RealtimeDomainEvent } from '../../infrastructure/realtime/RealtimeGateway';

import { copy } from '../../i18n/en';
import { IncomingCallDialog } from '../calls/IncomingCallDialog';
import { CreateCommunityDialog } from '../community/CreateCommunityDialog';
import { CommunityDiscoveryDialog } from '../community/CommunityDiscoveryDialog';
import { SegmentedControl } from '../common/SegmentedControl';
import { CreateConversationDialog } from '../dialog/CreateConversationDialog';
import { Inspector } from './Inspector';
import {
  MessageContextMenu,
  type MessageContextMenuState,
} from './MessageContextMenu';
import { NodeSettingsDialog } from './NodeSettingsDialog';
import { NotificationsPanel } from './NotificationsPanel';
import { RawMessageDialog } from './RawMessageDialog';
import { RealtimeEventsDialog } from './RealtimeEventsDialog';

interface WorkspaceDialogsProps {
  activeConversation?: ConversationResource;
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
  notificationsOpen: boolean;
  peers: Peer[];
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
  onCloseRawMessage: () => void;
  onCloseRealtimeEvents: () => void;
  onCommunityCreated: (input: {
    community: Community;
    session: Session;
  }) => void;
  onCommunityOpen: (communityId: string) => void;
  onCommunityJoinRequested: (request: CommunityMembershipRequest) => void;
  onConversationCreated: (
    nextSession: Session,
    conversation: ConversationResource,
  ) => void;
  onDeclineIncomingCall: () => void;
  onDeclineMembershipRequest: (requestId: string) => void;
  onAcceptMembershipRequest: (requestId: string) => void;
  onDeclineNotification: (notificationId: string) => void;
  onDeleteMessage: (message: ChatMessage) => void;
  onNetworksUpdated: () => Promise<void>;
  onReplyToMessage: (message: ChatMessage) => void;
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
        { label: copy.communities.discover, value: 'discover' },
        { label: copy.communities.create, value: 'create' },
      ]}
    />
  );
}

function MobileInspectorDialog(
  props: WorkspaceDialogsProps,
): ReactElement | null {
  if (!props.inspectorOpen) return null;

  return (
    <>
      <button
        className="fixed inset-0 z-40 bg-black/50 xl:hidden"
        onClick={props.onCloseInspector}
        aria-label={copy.dialog.close}
      />
      <div className="fixed inset-y-0 right-0 z-50 w-[86vw] max-w-[360px] p-3 xl:hidden">
        <Inspector
          className="h-full overflow-y-auto"
          session={props.session}
          activeConversation={props.activeConversation}
          messages={props.messages}
          onClose={props.onCloseInspector}
          peers={props.peers}
        />
      </div>
    </>
  );
}

function MessageActionDialogs(
  props: WorkspaceDialogsProps,
): ReactElement | null {
  const contextMenuMessage = props.messageContextMenu?.message;

  if (!props.messageContextMenu) {
    return props.rawMessage ? (
      <RawMessageDialog
        message={props.rawMessage}
        onClose={props.onCloseRawMessage}
      />
    ) : null;
  }

  return (
    <>
      <MessageContextMenu
        currentIdentityId={props.session.identity.id}
        menu={props.messageContextMenu}
        onClose={props.onCloseMessageContextMenu}
        onDelete={
          contextMenuMessage?.authorIdentityId === props.session.identity.id
            ? () => props.onDeleteMessage(contextMenuMessage)
            : undefined
        }
        onReply={() => {
          if (contextMenuMessage) props.onReplyToMessage(contextMenuMessage);
        }}
        onReactionToggle={props.onToggleReaction}
        onViewRaw={() => {
          if (contextMenuMessage) props.onViewRawMessage(contextMenuMessage);
        }}
      />
      {props.rawMessage && (
        <RawMessageDialog
          message={props.rawMessage}
          onClose={props.onCloseRawMessage}
        />
      )}
    </>
  );
}

function CreateDialogs(
  props: WorkspaceDialogsProps & {
    communityEntryMode: CommunityEntryMode;
    onCommunityEntryModeChange: (mode: CommunityEntryMode) => void;
  },
): ReactElement | null {
  if (props.isCreateOpen) {
    return (
      <CreateConversationDialog
        nodeNetworks={props.nodeNetworks}
        session={props.session}
        onClose={props.onCloseCreateConversation}
        onCreated={props.onConversationCreated}
      />
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
      <CreateCommunityDialog
        headerControl={modeControl}
        nodeNetworks={props.nodeNetworks}
        session={props.session}
        onClose={props.onCloseCreateCommunity}
        onCreated={props.onCommunityCreated}
      />
    );
  }

  return (
    <CommunityDiscoveryDialog
      headerControl={modeControl}
      nodeNetworks={props.nodeNetworks}
      onClose={props.onCloseCreateCommunity}
      onCommunityOpen={props.onCommunityOpen}
      onJoinRequested={props.onCommunityJoinRequested}
      session={props.session}
    />
  );
}

function WorkspaceNotificationDialog(
  props: WorkspaceDialogsProps,
): ReactElement | null {
  if (!props.notificationsOpen) return null;

  return (
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
  );
}

function NodeSettingsOverlay(
  props: WorkspaceDialogsProps,
): ReactElement | null {
  if (!props.nodeSettingsOpen) return null;

  return (
    <NodeSettingsDialog
      networks={props.nodeNetworks}
      node={props.node}
      onClose={props.onCloseNodeSettings}
      onNetworksUpdated={props.onNetworksUpdated}
      session={props.session}
    />
  );
}

function RealtimeEventsOverlay(
  props: WorkspaceDialogsProps,
): ReactElement | null {
  if (!props.realtimeEventsOpen) return null;

  return (
    <RealtimeEventsDialog
      events={props.realtimeEventLog}
      onClose={props.onCloseRealtimeEvents}
    />
  );
}

function IncomingCallOverlay(
  props: WorkspaceDialogsProps,
): ReactElement | null {
  if (!props.incomingCall) return null;

  return (
    <IncomingCallDialog
      caller={props.incomingCall.caller}
      onAccept={props.onAcceptIncomingCall}
      onDecline={props.onDeclineIncomingCall}
      title={props.incomingCall.title}
    />
  );
}
