export type BaseNotificationResource = {
  createdAt: string;
  id: string;
  recipientIdentityId: string;
  state: 'accepted' | 'declined' | 'pending';
  status: 'read' | 'unread';
};
