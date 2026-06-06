import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import {
  currentPwaNotificationPermission,
  ensurePwaPushSubscription,
  showPwaNotification,
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
  pushManager?: boolean;
  requestedPermission?: NotificationPermission;
}): {
  existingUnsubscribe: jest.Mock<Promise<boolean>, []>;
  getSubscription: jest.Mock<Promise<PushSubscription | null>, []>;
  requestPermission: jest.Mock<Promise<NotificationPermission>, []>;
  showNotification: jest.Mock<Promise<void>, [string, NotificationOptions?]>;
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
  const showNotification = jest.fn<
    Promise<void>,
    [string, NotificationOptions?]
  >(() => Promise.resolve());
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
          ...(input.pushManager === false
            ? {}
            : {
                pushManager: {
                  getSubscription,
                  subscribe,
                },
              }),
          showNotification,
        }),
      },
    },
  });

  if (input.pushManager !== false) {
    Object.defineProperty(globalThis, 'PushManager', {
      configurable: true,
      value: class PushManager {},
    });
  } else {
    Reflect.deleteProperty(globalThis, 'PushManager');
  }

  return {
    existingUnsubscribe,
    getSubscription,
    requestPermission,
    showNotification,
    subscribe,
    subscriptionJson,
  };
}

function installDocumentVisibility(input: {
  focused?: boolean;
  visibilityState: DocumentVisibilityState;
}): void {
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      hasFocus: () => input.focused ?? true,
      visibilityState: input.visibilityState,
    },
  });
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
  const originalDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    'document',
  );

  afterEach(() => {
    jest.clearAllMocks();
    restoreGlobalProperty('navigator', originalNavigator);
    restoreGlobalProperty('Notification', originalNotification);
    restoreGlobalProperty('PushManager', originalPushManager);
    restoreGlobalProperty('document', originalDocument);
  });

  it('does not request browser permission from automatic subscription checks', async () => {
    const { requestPermission } = installPushBrowser({ permission: 'default' });

    await expect(ensurePwaPushSubscription(session())).resolves.toBe(
      'permission_denied',
    );

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

    await expect(
      ensurePwaPushSubscription(session(), { requestPermission: true }),
    ).resolves.toBe('granted');

    expect(calls).toEqual(['permission', 'vapid']);
    expect(
      mockedApplicationContainer.registerPushSubscription,
    ).toHaveBeenCalledWith(session(), subscriptionJson);
  });

  it('reuses the same explicit enable flow when activation is requested twice at once', async () => {
    const { requestPermission, subscribe } = installPushBrowser({
      permission: 'default',
      requestedPermission: 'granted',
    });
    mockCurrentVapidPublicKey();

    await expect(
      Promise.all([
        ensurePwaPushSubscription(session(), { requestPermission: true }),
        ensurePwaPushSubscription(session(), { requestPermission: true }),
      ]),
    ).resolves.toEqual(['granted', 'granted']);

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(
      mockedApplicationContainer.registerPushSubscription,
    ).toHaveBeenCalledTimes(1);
  });

  it('does not register a subscription when the explicit permission request is denied', async () => {
    const { requestPermission } = installPushBrowser({
      permission: 'default',
      requestedPermission: 'denied',
    });

    await expect(
      ensurePwaPushSubscription(session(), { requestPermission: true }),
    ).resolves.toBe('permission_denied');

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(
      mockedApplicationContainer.getPushVapidPublicKey,
    ).not.toHaveBeenCalled();
    expect(
      mockedApplicationContainer.registerPushSubscription,
    ).not.toHaveBeenCalled();
  });

  it('reports the current permission only when service workers and notifications are supported', () => {
    installPushBrowser({ permission: 'default' });

    expect(currentPwaNotificationPermission()).toBe('default');

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {},
    });

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

    await expect(ensurePwaPushSubscription(session())).resolves.toBe('granted');

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

    await expect(ensurePwaPushSubscription(session())).resolves.toBe('granted');

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

    await expect(ensurePwaPushSubscription(session())).resolves.toBe('granted');

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

  it('does not show a local notification while the page is visible and focused', async () => {
    const { showNotification } = installPushBrowser({ permission: 'granted' });

    installDocumentVisibility({
      focused: true,
      visibilityState: 'visible',
    });

    await showPwaNotification({
      body: 'Notification body',
      tag: 'notification-tag',
      title: 'Notification title',
    });

    expect(showNotification).not.toHaveBeenCalled();
  });

  it('shows a local notification when the page is visible but not focused', async () => {
    const { showNotification } = installPushBrowser({ permission: 'granted' });

    installDocumentVisibility({
      focused: false,
      visibilityState: 'visible',
    });

    await showPwaNotification({
      body: 'Notification body',
      tag: 'notification-tag',
      title: 'Notification title',
      url: '/messages',
    });

    expect(showNotification).toHaveBeenCalledWith(
      'Notification title',
      expect.objectContaining({
        body: 'Notification body',
        data: { url: '/messages' },
        tag: 'notification-tag',
      }),
    );
  });

  it('reports server_disabled when VAPID settings are disabled', async () => {
    installPushBrowser({ permission: 'granted' });
    mockedApplicationContainer.getPushVapidPublicKey.mockResolvedValue({
      enabled: false,
    });

    await expect(ensurePwaPushSubscription(session())).resolves.toBe(
      'server_disabled',
    );

    expect(
      mockedApplicationContainer.registerPushSubscription,
    ).not.toHaveBeenCalled();
  });

  it('does not require a global PushManager when the registration exposes pushManager', async () => {
    const { subscriptionJson } = installPushBrowser({
      permission: 'granted',
      pushManager: true,
    });

    Reflect.deleteProperty(globalThis, 'PushManager');
    mockCurrentVapidPublicKey();

    await expect(ensurePwaPushSubscription(session())).resolves.toBe('granted');
    expect(
      mockedApplicationContainer.registerPushSubscription,
    ).toHaveBeenCalledWith(session(), subscriptionJson);
  });

  it('reports unsupported when the service worker registration has no pushManager', async () => {
    installPushBrowser({
      permission: 'granted',
      pushManager: false,
    });
    mockCurrentVapidPublicKey();

    await expect(ensurePwaPushSubscription(session())).resolves.toBe(
      'unsupported',
    );
    expect(
      mockedApplicationContainer.registerPushSubscription,
    ).not.toHaveBeenCalled();
  });
});
