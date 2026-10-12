import type { WorkspaceCreationDialogs } from './WorkspaceCreationDialogs';
import type { WorkspaceIncomingCallDialog } from './WorkspaceIncomingCallDialog';
import type { WorkspaceInspectorDialog } from './WorkspaceInspectorDialog';
import type { WorkspaceMessageActionDialogs } from './WorkspaceMessageActionDialogs';
import type { WorkspaceNodeSettingsDialog } from './WorkspaceNodeSettingsDialog';
import type { WorkspaceNotificationsDialog } from './WorkspaceNotificationsDialog';
import type { WorkspaceNotificationSettingsDialog } from './WorkspaceNotificationSettingsDialog';
import type { WorkspaceRealtimeEventsDialog } from './WorkspaceRealtimeEventsDialog';

export type WorkspaceDialogSections = {
  creation: WorkspaceCreationDialogs;
  incomingCall: WorkspaceIncomingCallDialog;
  inspector: WorkspaceInspectorDialog;
  messageActions: WorkspaceMessageActionDialogs;
  nodeSettings: WorkspaceNodeSettingsDialog;
  notificationSettings: WorkspaceNotificationSettingsDialog;
  notifications: WorkspaceNotificationsDialog;
  realtimeEvents: WorkspaceRealtimeEventsDialog;
};
