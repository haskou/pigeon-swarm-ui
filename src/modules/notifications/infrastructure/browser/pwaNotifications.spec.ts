import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { ensurePwaPushSubscription } from './pwaNotifications';

jest.mock('../../../../app/composition/applicationContainer', () => ({
  applicationContainer: {
    deletePushSubscription: jest.fn(),
    getPushVapidPublicKey: jest.fn(),
    registerPushSubscription: jest.fn(),
  },
}));

const mockedApplicationContainer = jest.mocked(applicationContainer);

function restoreGlobalProperty(
  property: string,
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) {
    Object.defineProperty(globalThis, property, descriptor);

    return;
  }

  Reflect.deleteProperty(globalThis, property);
}

function installPushBrowser(input: {
  calls?: string[];
  permission: NotificationPermission;
  requestedPermission?: NotificationPermission;
}): {
  requestPermission: jest.Mock<Promise<NotificationPermission>, []>;
  subscriptionJson: PushSubscriptionJSON;
} {
  let permission = input.permission;
  const subscriptionJson = {
    endpoint: 'https://push.example/subscription',
    expirationTime: null,
    keys: {
      auth: 'auth-key',
      p256dh: 'p256dh-key',
    },
  };
  const requestPermission = jest.fn(() => {
    input.calls?.push('permission');
    permission = input.requestedPermission ?? permission;

    return Promise.resolve(permission);
  });
  const subscribe = jest.fn(() =>
    Promise.resolve({
      toJSON: () => subscriptionJson,
    }),
  );
  const getSubscription = jest.fn(() => Promise.resolve(null));

  Object.defineProperty(globalThis, 'Notification', {
    configurable: true,
    value: {
      get permission() {
        return permission;
      },
      requestPermission,
    },
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      serviceWorker: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription,
            subscribe,
          },
        }),
      },
    },
  });
  Object.defineProperty(globalThis, 'PushManager', {
    configurable: true,
    value: class PushManager {},
  });

  return {
    requestPermission,
    subscriptionJson,
  };
}

function session(): Session {
  return {
    identity: {
      id: 'identity-1',
    },
  } as Session;
}

describe(ensurePwaPushSubscription.name, () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    'navigator',
  );
  const originalNotification = Object.getOwnPropertyDescriptor(
    globalThis,
    'Notification',
  );
  const originalPushManager = Object.getOwnPropertyDescriptor(
    globalThis,
    'PushManager',
  );

  afterEach(() => {
    jest.clearAllMocks();
    restoreGlobalProperty('navigator', originalNavigator);
    restoreGlobalProperty('Notification', originalNotification);
    restoreGlobalProperty('PushManager', originalPushManager);
  });

  it('does not request browser permission from automatic subscription checks', async () => {
    const { requestPermission } = installPushBrowser({ permission: 'default' });

    await ensurePwaPushSubscription(session());

    expect(requestPermission).not.toHaveBeenCalled();
    expect(
      mockedApplicationContainer.getPushVapidPublicKey,
    ).not.toHaveBeenCalled();
    expect(
      mockedApplicationContainer.registerPushSubscription,
    ).not.toHaveBeenCalled();
  });

  it('requests permission from the explicit enable flow before loading VAPID settings', async () => {
    const calls: string[] = [];
    const { subscriptionJson } = installPushBrowser({
      calls,
      permission: 'default',
      requestedPermission: 'granted',
    });
    mockedApplicationContainer.getPushVapidPublicKey.mockImplementation(() => {
      calls.push('vapid');

      return Promise.resolve({
        enabled: true,
        publicKey:
          'BCWL2DKOOVa23vOI4hzvPv7I5ckKuUybPqzoFt0xb4DrcpV4OUasxryIsfvebrxmNzbR5gJTMN6sVojhPWAiPpE',
      });
    });

    await ensurePwaPushSubscription(session(), { requestPermission: true });

    expect(calls).toEqual(['permission', 'vapid']);
    expect(
      mockedApplicationContainer.registerPushSubscription,
    ).toHaveBeenCalledWith(session(), subscriptionJson);
  });
});
