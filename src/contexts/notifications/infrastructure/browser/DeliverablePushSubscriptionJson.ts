export type DeliverablePushSubscriptionJson = PushSubscriptionJSON & {
  endpoint: string;
  keys: {
    auth: string;
    p256dh: string;
  };
};
