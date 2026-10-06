export type BaseNotificationResource = {
  id: string;
  recipientIdentityId: string;
  state: 'accepted' | 'declined' | 'pending';
  status: 'read' | 'unread';
};
