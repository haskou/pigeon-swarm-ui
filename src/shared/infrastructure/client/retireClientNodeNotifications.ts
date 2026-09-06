export async function retireClientNodeNotifications(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator))
    return;

  try {
    const registration = await navigator.serviceWorker.getRegistration();

    if (!registration) return;
    const subscription = await registration.pushManager?.getSubscription();

    if (subscription && !(await subscription.unsubscribe())) {
      throw new Error('Unsubscribe failed.');
    }

    if (typeof registration.getNotifications !== 'function') return;
    const notifications = await registration.getNotifications();

    notifications.forEach((notification) => notification.close());
  } catch {
    throw new Error(
      'Could not disconnect notifications from the previous node.',
    );
  }
}
