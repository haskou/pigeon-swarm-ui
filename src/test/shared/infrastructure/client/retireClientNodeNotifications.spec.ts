import { mock } from 'jest-mock-extended';

import { retireClientNodeNotifications } from '../../../../shared/infrastructure/client/retireClientNodeNotifications';

describe('retireClientNodeNotifications', () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    'navigator',
  );
  const subscription = mock<PushSubscription>();
  const pushManager = mock<PushManager>();
  const registration = mock<ServiceWorkerRegistration>({ pushManager });
  const serviceWorker = mock<ServiceWorkerContainer>();
  const notification = mock<Notification>();

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { serviceWorker },
    });
    serviceWorker.getRegistration.mockResolvedValue(registration);
    pushManager.getSubscription.mockResolvedValue(subscription);
    subscription.unsubscribe.mockResolvedValue(true);
    registration.getNotifications.mockResolvedValue([notification]);
  });

  afterEach(() => {
    if (originalNavigator) {
      Object.defineProperty(globalThis, 'navigator', originalNavigator);
    } else {
      Reflect.deleteProperty(globalThis, 'navigator');
    }
  });

  it('unsubscribes the old node and closes its visible notifications', async () => {
    await retireClientNodeNotifications();

    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(notification.close).toHaveBeenCalledTimes(1);
  });

  it('closes visible notifications even when no subscription remains', async () => {
    pushManager.getSubscription.mockResolvedValue(null);

    await retireClientNodeNotifications();

    expect(subscription.unsubscribe).not.toHaveBeenCalled();
    expect(notification.close).toHaveBeenCalledTimes(1);
  });

  it('handles an absent registration', async () => {
    serviceWorker.getRegistration.mockResolvedValue(undefined);

    await expect(retireClientNodeNotifications()).resolves.toBeUndefined();
    expect(pushManager.getSubscription).not.toHaveBeenCalled();
  });

  it('handles a browser without service workers', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {},
    });

    await expect(retireClientNodeNotifications()).resolves.toBeUndefined();
    expect(serviceWorker.getRegistration).not.toHaveBeenCalled();
  });

  it('fails closed when the browser does not confirm unsubscription', async () => {
    subscription.unsubscribe.mockResolvedValue(false);

    await expect(retireClientNodeNotifications()).rejects.toThrow(
      'Could not disconnect notifications from the previous node.',
    );
  });

  it('replaces subscription failures with a controlled error', async () => {
    subscription.unsubscribe.mockRejectedValue(
      new Error('private browser detail'),
    );

    await expect(retireClientNodeNotifications()).rejects.toThrow(
      'Could not disconnect notifications from the previous node.',
    );
  });

  it('fails closed if the browser cannot inspect the current subscription', async () => {
    pushManager.getSubscription.mockRejectedValue(new Error('unavailable'));

    await expect(retireClientNodeNotifications()).rejects.toThrow(
      'Could not disconnect notifications from the previous node.',
    );
  });
});
