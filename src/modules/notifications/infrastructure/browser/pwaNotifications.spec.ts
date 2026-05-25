import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import {
  currentPwaNotificationPermission,
  ensurePwaPushSubscription,
} from './pwaNotifications';

jest.mock('../../../../app/composition/applicationContainer', () => ({
  applicationContainer: {
    deletePushSubscription: jest.fn(),
    getPushVapidPublicKey: jest.fn(),
    registerPushSubscription: jest.fn(),
  },
}));

const mockedApplicationContainer = jest.mocked(applicationContainer);
const currentVapidPublicKey =
  'BCWL2DKOOVa23vOI4hzvPv7I5ckKuUybPqzoFt0xb4DrcpV4OUasxryIsfvebrxmNzbR5gJTMN6sVojhPWAiPpE';

function base64UrlBytes(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(rawData.length));

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }

  return output;
}

function currentApplicationServerKey(): Uint8Array<ArrayBuffer> {
  return base64UrlBytes(currentVapidPublicKey);
}

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
  existingSubscription?: {
    applicationServerKey: BufferSource | null;
    exposeOptions?: boolean;
    json: PushSubscriptionJSON;
  };
  permission: NotificationPermission;
  requestedPermission?: NotificationPermission;
}): {
  existingUnsubscribe: jest.Mock<Promise<boolean>, []>;
  getSubscription: jest.Mock<Promise<PushSubscription | null>, []>;
  requestPermission: jest.Mock<Promise<NotificationPermission>, []>;
  subscribe: jest.Mock<Promise<PushSubscription>, []>;
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
    } as unknown as PushSubscription),
  );
  const existingUnsubscribe = jest.fn(() => Promise.resolve(true));
  const existingSubscription = input.existingSubscription
    ? ({
        ...(input.existingSubscription.exposeOptions === false
          ? {}
          : {
              options: {
                applicationServerKey:
                  input.existingSubscription.applicationServerKey,
              },
            }),
        toJSON: () => input.existingSubscription?.json ?? {},
        unsubscribe: existingUnsubscribe,
      } as unknown as PushSubscription)
    : null;
  const getSubscription = jest.fn(() => Promise.resolve(existingSubscription));

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
    existingUnsubscribe,
    getSubscription,
    requestPermission,
    subscribe,
    subscriptionJson,
  };
}

function mockCurrentVapidPublicKey(): void {
  mockedApplicationContainer.getPushVapidPublicKey.mockResolvedValue({
    enabled: true,
    publicKey: currentVapidPublicKey,
  });
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
        publicKey: currentVapidPublicKey,
      });
    });

    await ensurePwaPushSubscription(session(), { requestPermission: true });

    expect(calls).toEqual(['permission', 'vapid']);
    expect(
      mockedApplicationContainer.registerPushSubscription,
    ).toHaveBeenCalledWith(session(), subscriptionJson);
  });

  it('does not register a subscription when the explicit permission request is denied', async () => {
    const { requestPermission } = installPushBrowser({
      permission: 'default',
      requestedPermission: 'denied',
    });

    await ensurePwaPushSubscription(session(), { requestPermission: true });

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(
      mockedApplicationContainer.getPushVapidPublicKey,
    ).not.toHaveBeenCalled();
    expect(
      mockedApplicationContainer.registerPushSubscription,
    ).not.toHaveBeenCalled();
  });

  it('reports the current permission only when push subscriptions are supported', () => {
    installPushBrowser({ permission: 'default' });

    expect(currentPwaNotificationPermission()).toBe('default');

    Reflect.deleteProperty(globalThis, 'PushManager');

    expect(currentPwaNotificationPermission()).toBe('unsupported');
  });

  it('replaces an existing subscription created with a different VAPID key', async () => {
    const oldSubscriptionJson = {
      endpoint: 'https://push.example/old-subscription',
      expirationTime: null,
      keys: {
        auth: 'old-auth-key',
        p256dh: 'old-p256dh-key',
      },
    };
    const { existingUnsubscribe, subscribe, subscriptionJson } =
      installPushBrowser({
        existingSubscription: {
          applicationServerKey: base64UrlBytes('ZGlmZmVyZW50'),
          json: oldSubscriptionJson,
        },
        permission: 'granted',
      });
    mockCurrentVapidPublicKey();

    await ensurePwaPushSubscription(session());

    expect(
      mockedApplicationContainer.deletePushSubscription,
    ).toHaveBeenCalledWith(session(), oldSubscriptionJson);
    expect(existingUnsubscribe).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledWith({
      applicationServerKey: currentApplicationServerKey(),
      userVisibleOnly: true,
    });
    expect(
      mockedApplicationContainer.registerPushSubscription,
    ).toHaveBeenCalledWith(session(), subscriptionJson);
  });

  it('replaces an existing subscription whose browser JSON is not deliverable', async () => {
    const { existingUnsubscribe, subscribe, subscriptionJson } =
      installPushBrowser({
        existingSubscription: {
          applicationServerKey: currentApplicationServerKey(),
          json: {
            endpoint: 'https://push.example/broken-subscription',
          } as PushSubscriptionJSON,
        },
        permission: 'granted',
      });
    mockCurrentVapidPublicKey();

    await ensurePwaPushSubscription(session());

    expect(
      mockedApplicationContainer.deletePushSubscription,
    ).not.toHaveBeenCalled();
    expect(existingUnsubscribe).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledWith({
      applicationServerKey: currentApplicationServerKey(),
      userVisibleOnly: true,
    });
    expect(
      mockedApplicationContainer.registerPushSubscription,
    ).toHaveBeenCalledWith(session(), subscriptionJson);
  });

  it('replaces an existing subscription when the browser hides the subscribed VAPID key', async () => {
    const oldSubscriptionJson = {
      endpoint: 'https://push.example/old-subscription',
      expirationTime: null,
      keys: {
        auth: 'old-auth-key',
        p256dh: 'old-p256dh-key',
      },
    };
    const { existingUnsubscribe, subscribe, subscriptionJson } =
      installPushBrowser({
        existingSubscription: {
          applicationServerKey: currentApplicationServerKey(),
          exposeOptions: false,
          json: oldSubscriptionJson,
        },
        permission: 'granted',
      });
    mockCurrentVapidPublicKey();

    await ensurePwaPushSubscription(session());

    expect(
      mockedApplicationContainer.deletePushSubscription,
    ).toHaveBeenCalledWith(session(), oldSubscriptionJson);
    expect(existingUnsubscribe).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledWith({
      applicationServerKey: currentApplicationServerKey(),
      userVisibleOnly: true,
    });
    expect(
      mockedApplicationContainer.registerPushSubscription,
    ).toHaveBeenCalledWith(session(), subscriptionJson);
  });
});
