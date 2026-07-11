export function pushSubscriptionPayload(subscription: PushSubscriptionJSON): {
  endpoint: string;
  expirationTime?: number | null;
  keys: { auth: string; p256dh: string };
} {
  if (
    !subscription.endpoint ||
    !subscription.keys?.auth ||
    !subscription.keys.p256dh
  ) {
    throw new Error('Invalid push subscription.');
  }

  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime,
    keys: {
      auth: subscription.keys.auth,
      p256dh: subscription.keys.p256dh,
    },
  };
}
